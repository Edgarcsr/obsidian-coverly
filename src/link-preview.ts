import { Component, MarkdownRenderer, getLinkpath } from "obsidian";
import type { App, Events, TFile } from "obsidian";

import { paintCover } from "./header";
import type CoverlyPlugin from "./main";
import { dataFromFrontmatter } from "./note-data";
import { drawPageIcon } from "./page-icon";

/** Tempo com o mouse parado no link antes do cartão aparecer, como no Notion. */
const SHOW_DELAY = 450;
/** Distância entre o link e o cartão. */
const GAP = 6;
/** Espaço mínimo entre o cartão e as bordas da janela. */
const MARGIN = 8;
/** Só o começo da nota entra na prévia; o resto ficaria escondido de qualquer jeito. */
const MAX_PREVIEW_CHARS = 1500;

/** O que o Obsidian manda no evento `hover-link`. */
export interface HoverLinkInfo {
  event: MouseEvent;
  targetEl: HTMLElement;
  linktext: string;
  sourcePath: string;
}

export const isHoverLinkInfo = (value: unknown): value is HoverLinkInfo => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const info = value as Partial<HoverLinkInfo>;
  return (
    info.event instanceof MouseEvent &&
    info.targetEl instanceof HTMLElement &&
    typeof info.linktext === "string"
  );
};

/**
 * Nota markdown apontada por um `hover-link`, ou `null`. O explorador manda o
 * caminho exato; tentar por ele primeiro evita que `getLinkpath` corte nomes
 * com "#" ou "^", que num link marcariam seção.
 */
export const resolveHoverFile = (
  app: App,
  info: HoverLinkInfo
): TFile | null => {
  const file =
    app.vault.getFileByPath(info.linktext) ??
    app.metadataCache.getFirstLinkpathDest(
      getLinkpath(info.linktext),
      info.sourcePath
    );
  return file?.extension === "md" ? file : null;
};

/** A prévia nativa do Obsidian (plugin "Pré-visualização de página") já está aberta. */
const nativePreviewOpen = (): boolean =>
  document.querySelector(".popover.hover-popover") !== null;

/** Coloca o cartão abaixo do link; sem espaço embaixo, acima. */
const position = (card: HTMLElement, target: HTMLElement): void => {
  const anchor = target.getBoundingClientRect();
  const { offsetWidth: width, offsetHeight: height } = card;
  const maxLeft = window.innerWidth - width - MARGIN;
  const left = Math.max(MARGIN, Math.min(anchor.left, maxLeft));
  const below = anchor.bottom + GAP;
  const top =
    below + height <= window.innerHeight - MARGIN
      ? below
      : Math.max(MARGIN, anchor.top - GAP - height);
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
};

/**
 * Cartão de prévia dos links internos, no estilo do Notion: capa e ícone
 * (quando a nota tem), pastas, título e o começo da nota, esmaecendo no fim. Aparece ao parar o mouse
 * sobre um link e some ao sair dele, clicar, rolar ou digitar.
 *
 * Usa o evento `hover-link`, que o Obsidian dispara em todo link interno
 * (leitura, edição, explorador, abas). Com Ctrl/Cmd pressionado, ou se a
 * prévia nativa já abriu, o cartão sai de cena para não haver duas.
 */
export class LinkPreview {
  private readonly plugin: CoverlyPlugin;
  private card: HTMLElement | null = null;
  private target: HTMLElement | null = null;
  private timer: number | null = null;
  /** Dono do markdown desenhado no cartão; descarregá-lo limpa o que ele registrou. */
  private content: Component | null = null;

  constructor(plugin: CoverlyPlugin) {
    this.plugin = plugin;
  }

  register(): void {
    const { plugin } = this;
    // O `hover-link` não está nas tipagens do Workspace, só no `on` genérico de Events.
    const workspace: Events = plugin.app.workspace;
    plugin.registerEvent(
      workspace.on("hover-link", (info: unknown) => {
        if (isHoverLinkInfo(info)) {
          this.onHover(info);
        }
      })
    );
    const hide = (): void => {
      this.hide();
    };
    plugin.registerDomEvent(document, "mousedown", hide, true);
    plugin.registerDomEvent(document, "keydown", hide, true);
    plugin.registerDomEvent(document, "wheel", hide, {
      capture: true,
      passive: true,
    });
  }

  destroy(): void {
    this.hide();
  }

  private onHover(info: HoverLinkInfo): void {
    if (!this.plugin.settings.linkPreview || info.targetEl === this.target) {
      return;
    }
    this.hide();
    if (info.event.ctrlKey || info.event.metaKey) {
      return;
    }

    const file = resolveHoverFile(this.plugin.app, info);
    if (!file) {
      return;
    }

    const target = info.targetEl;
    this.target = target;
    // `mouseleave` não borbulha, então cada link ganha o seu ouvinte, tirado no hide.
    target.addEventListener("mouseleave", this.onLeave);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.show(file, target);
    }, SHOW_DELAY);
  }

  private readonly onLeave = (): void => {
    this.hide();
  };

  private async show(file: TFile, target: HTMLElement): Promise<void> {
    if (nativePreviewOpen() || !target.isConnected) {
      this.hide();
      return;
    }

    const { app, settings } = this.plugin;
    const cache = app.metadataCache.getFileCache(file);
    const data = dataFromFrontmatter(cache?.frontmatter);

    const card = document.body.createDiv({ cls: "mdp-link-card" });
    this.card = card;

    // Capa e ícone só quando a nota tem; nada é posto no lugar.
    if (data.cover) {
      card.addClass("has-cover");
      paintCover(app, card.createDiv({ cls: "mdp-link-card-cover" }), data);
    }
    if (data.icon) {
      drawPageIcon(
        app,
        card.createDiv({ cls: "mdp-link-card-icon" }),
        data.icon,
        settings.twemoji
      );
    }
    const folder = file.parent?.isRoot() === false ? file.parent.path : "";
    if (folder !== "") {
      card.createDiv({
        cls: "mdp-link-card-path",
        text: folder.split("/").join(" / "),
      });
    }
    card.createDiv({ cls: "mdp-link-card-title", text: file.basename });
    const body = card.createDiv({
      cls: "mdp-link-card-body markdown-rendered",
    });
    position(card, target);

    const text = await app.vault.cachedRead(file);
    // O mouse pode ter saído enquanto a nota era lida.
    if (this.card !== card) {
      return;
    }
    const start = cache?.frontmatterPosition?.end.offset ?? 0;
    const markdown = text.slice(start, start + MAX_PREVIEW_CHARS).trim();
    if (markdown === "") {
      body.remove();
      position(card, target);
      return;
    }
    const content = new Component();
    content.load();
    this.content = content;
    await MarkdownRenderer.render(app, markdown, body, file.path, content);
    if (this.card === card) {
      position(card, target);
    }
  }

  private hide(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.target?.removeEventListener("mouseleave", this.onLeave);
    this.target = null;
    this.content?.unload();
    this.content = null;
    this.card?.remove();
    this.card = null;
  }
}
