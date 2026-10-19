import { Component, MarkdownRenderer, getLinkpath, moment } from "obsidian";
import type { App, Events, TFile, View } from "obsidian";

import { coverThumbUrl } from "./cover-thumbs";
import { paintCover, preloadCover } from "./header";
import { t } from "./i18n";
import type CoverlyPlugin from "./main";
import { dataFromFrontmatter } from "./note-data";
import { drawPageIcon } from "./page-icon";
import { formatSize } from "./storage";
import { isImageFile } from "./vault-images";

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

/**
 * Nota ou imagem apontada por um `hover-link`. Imagens só pelo caminho exato
 * (o explorador e os links para imagens mandam o caminho).
 */
const resolvePreviewFile = (app: App, info: HoverLinkInfo): TFile | null => {
  const exact = app.vault.getFileByPath(info.linktext);
  if (exact && isImageFile(exact)) {
    return exact;
  }
  return resolveHoverFile(app, info);
};

/** Item de arquivo no explorador (onde o Obsidian mostra a dica com as datas). */
const EXPLORER_ITEM = ".nav-files-container .nav-file-title[data-path]";

/** "Editada há 2 horas · criada em 12 de out. de 2025", no idioma do Obsidian. */
const datesLine = (file: TFile): string =>
  t("linkPreview.dates", {
    created: moment(file.stat.ctime).format("ll"),
    modified: moment(file.stat.mtime).fromNow(),
  });

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
    // No explorador, o Obsidian mostra a dica (datas) e dispara o `hover-link`
    // no mesmo `pointerover`. Com a opção ligada, esse evento é parado antes de
    // chegar ao explorador e só o `hover-link` é disparado: a dica nem chega a
    // existir (escondê-la depois deixava um resto piscando ao sair do item).
    plugin.registerDomEvent(
      document,
      "pointerover",
      (event) => {
        this.onExplorerPointerover(event);
      },
      true
    );
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

  private onExplorerPointerover(event: PointerEvent): void {
    const { app, settings } = this.plugin;
    if (!(settings.linkPreview && settings.hideFileTooltip)) {
      return;
    }
    const title =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(EXPLORER_ITEM)
        : null;
    const file = title
      ? app.vault.getFileByPath(title.dataset.path ?? "")
      : null;
    if (!(title && file && (file.extension === "md" || isImageFile(file)))) {
      return;
    }
    event.stopPropagation();
    // Como no Obsidian, só conta a entrada no item, não andar entre os filhos dele.
    const from = event.relatedTarget;
    if (from instanceof Node && title.contains(from)) {
      return;
    }
    const view = app.workspace
      .getLeavesOfType("file-explorer")
      .find((leaf) => leaf.view.containerEl.contains(title))?.view;
    // A prévia nativa (Ctrl + mouse) também ouve este evento, então ela continua.
    const hover: HoverLinkInfo & { hoverParent?: View; source: string } = {
      event,
      hoverParent: view,
      linktext: file.path,
      source: "file-explorer",
      sourcePath: "",
      targetEl: title,
    };
    app.workspace.trigger("hover-link", hover);
  }

  private onHover(info: HoverLinkInfo): void {
    if (info.targetEl === this.target) {
      return;
    }
    const hovered = resolvePreviewFile(this.plugin.app, info);
    // Quem para o mouse num link costuma abrir a nota: a capa já vai carregando.
    if (hovered?.extension === "md") {
      preloadCover(
        this.plugin.app,
        dataFromFrontmatter(
          this.plugin.app.metadataCache.getFileCache(hovered)?.frontmatter
        ).cover
      );
    }
    if (!this.plugin.settings.linkPreview) {
      return;
    }
    this.hide();
    if (info.event.ctrlKey || info.event.metaKey) {
      return;
    }

    const file = hovered;
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

    if (isImageFile(file)) {
      this.showImage(file, target);
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
    // No explorador, as datas que a dica do Obsidian mostraria.
    if (target.closest(EXPLORER_ITEM)) {
      card.createDiv({ cls: "mdp-link-card-meta", text: datesLine(file) });
    }
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

  /** Cartão de uma imagem: a própria imagem, pasta, nome, tamanho e datas. */
  private showImage(file: TFile, target: HTMLElement): void {
    const { app } = this.plugin;
    const card = document.body.createDiv({ cls: "mdp-link-card is-image" });
    this.card = card;

    const frame = card.createDiv({ cls: "mdp-link-card-image" });
    // A miniatura (se já existe) aparece enquanto a imagem carrega.
    const thumb = coverThumbUrl(file.path);
    if (thumb) {
      frame.style.backgroundImage = `url("${thumb.replaceAll('"', "%22")}")`;
    }
    const image = frame.createEl("img", {
      attr: { alt: "", src: app.vault.getResourcePath(file) },
    });

    const folder = file.parent?.isRoot() === false ? file.parent.path : "";
    if (folder !== "") {
      card.createDiv({
        cls: "mdp-link-card-path",
        text: folder.split("/").join(" / "),
      });
    }
    card.createDiv({ cls: "mdp-link-card-title", text: file.name });
    const size = card.createDiv({
      cls: "mdp-link-card-meta",
      text: formatSize(file.stat.size),
    });
    card.createDiv({ cls: "mdp-link-card-meta", text: datesLine(file) });
    image.addEventListener("load", () => {
      const dimensions = `${image.naturalWidth} × ${image.naturalHeight}`;
      size.setText(`${dimensions} · ${formatSize(file.stat.size)}`);
    });
    position(card, target);
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
