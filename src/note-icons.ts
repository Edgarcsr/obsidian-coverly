import { MarkdownView } from "obsidian";
import type { TFile } from "obsidian";

import { coverThumbUrl } from "./cover-thumbs";
import { iconPacksVersion } from "./icon-packs";
import type CoverlyPlugin from "./main";
import { dataFromFrontmatter, isHexColor } from "./note-data";
import type { CoverData } from "./note-data";
import { drawPageIcon, iconColorCss } from "./page-icon";
import { measure } from "./perf";
import { clearTitleIcon, paintTitleIcon } from "./title-icon";
import { isImageFile } from "./vault-images";

/** Arquivo e dados lidos uma vez por passada, por caminho. */
interface DecorPass {
  files: Map<string, TFile | null>;
  data: Map<string, CoverData | null>;
}

const ICON_CLASS = "mdp-inline-icon";
const NAME_CLASS = "mdp-name-colored";
const TREE_COVER_CLASS = "mdp-tree-cover";
const TREE_COVER_VAR = "--mdp-tree-cover";
/** Linhas do explorador que levam ícone: notas e pastas. */
const ROW_SELECTOR = ".nav-file-title[data-path], .nav-folder-title[data-path]";
const ROW_CONTENT_SELECTOR =
  ":scope > .nav-file-title-content, :scope > .nav-folder-title-content";
/** Espaçamento mínimo entre as passadas completas do explorador. */
const SWEEP_DELAY_MS = 180;

/** Camada CSS do fundo: só fotos, pela miniatura; degradês e cores ficam de fora. */
const treeCoverLayer = (cover: string | undefined): string | null => {
  if (!cover || cover.startsWith("gradient:") || isHexColor(cover)) {
    return null;
  }
  const thumb = coverThumbUrl(cover);
  return thumb ? `url("${thumb.replaceAll('"', "%22")}")` : null;
};

const clearTreeCover = (el: HTMLElement): void => {
  if (el.hasClass(TREE_COVER_CLASS)) {
    el.style.removeProperty(TREE_COVER_VAR);
    el.removeClass(TREE_COVER_CLASS);
  }
};

const clearName = (el: HTMLElement): void => {
  if (el.hasClass(NAME_CLASS)) {
    el.style.removeProperty("color");
    el.removeClass(NAME_CLASS);
  }
};

/**
 * Ícone da nota, em miniatura, onde o nome dela aparece fora do cabeçalho:
 * no título da barra superior da aba (ver title-icon.ts) e no explorador de
 * arquivos, como no Notion. No explorador, as pastas também levam o delas
 * (ver folder-icons.ts).
 *
 * O Obsidian redesenha esses lugares por conta própria (ao rolar a árvore,
 * abrir pastas, trocar de nota), então cada contêiner é observado e o
 * ícone é reposto quando some. Cada passada só mexe no DOM se algo mudou, o
 * que impede o observer de disparar a si mesmo sem fim.
 */
export class NoteIconDecorator {
  private readonly plugin: CoverlyPlugin;
  private readonly observers = new Map<HTMLElement, MutationObserver>();
  /** Títulos das abas com ícone, para limpar ao descarregar o plugin. */
  private readonly titles = new Set<HTMLElement>();
  private frame: number | null = null;
  private sweepTimer: number | null = null;
  private pass: DecorPass | null = null;
  /** Fundos (item + imagem) que já apareceram, para animar só a primeira vez. */
  private readonly shownBackgrounds = new Set<string>();

  constructor(plugin: CoverlyPlugin) {
    this.plugin = plugin;
  }

  /** Agrupa os avisos (metadados, layout, DOM) numa única passada por frame. */
  schedule(): void {
    if (this.frame !== null) {
      return;
    }
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.decorateAll();
    });
  }

  /** Decora agora, sem esperar o próximo frame (ver o onLayoutReady em main.ts). */
  flush(): void {
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.decorateAll();
  }

  destroy(): void {
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    if (this.sweepTimer !== null) {
      window.clearTimeout(this.sweepTimer);
      this.sweepTimer = null;
    }
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
    for (const icon of document.querySelectorAll(`.${ICON_CLASS}`)) {
      icon.remove();
    }
    for (const name of document.querySelectorAll<HTMLElement>(
      `.${NAME_CLASS}`
    )) {
      clearName(name);
    }
    for (const title of document.querySelectorAll<HTMLElement>(
      `.${TREE_COVER_CLASS}`
    )) {
      clearTreeCover(title);
    }
    for (const title of this.titles) {
      clearTitleIcon(title);
    }
    this.titles.clear();
  }

  private decorateAll(): void {
    measure("explorer.decorateAll", () => {
      this.withPass(() => this.decorateAllInPass());
    });
  }

  /** Observers ligados (explorador e abas), para o relatório de desempenho. */
  observerCount(): number {
    return this.observers.size;
  }

  private decorateAllInPass(): void {
    const { workspace } = this.plugin.app;
    const alive = new Set<HTMLElement>();

    for (const leaf of workspace.getLeavesOfType("file-explorer")) {
      const root = leaf.view.containerEl;
      alive.add(root);
      this.observe(root, true);
      for (const title of root.querySelectorAll<HTMLElement>(ROW_SELECTOR)) {
        this.decorateTitle(title);
      }
    }

    for (const leaf of workspace.getLeavesOfType("markdown")) {
      const { view } = leaf;
      const container = view.containerEl.querySelector<HTMLElement>(
        ".view-header-title-container"
      );
      const title = container?.querySelector<HTMLElement>(
        ":scope > .view-header-title"
      );
      if (!(view instanceof MarkdownView && container && title)) {
        continue;
      }
      alive.add(container);
      this.observe(container, false);
      this.titles.add(title);
      paintTitleIcon(
        this.plugin.app,
        title,
        this.iconFor(view.file?.path ?? ""),
        this.plugin.settings.twemoji
      );
      this.paintBreadcrumbs(container, view.file);
    }
    for (const title of this.titles) {
      if (!title.isConnected) {
        this.titles.delete(title);
      }
    }

    // Contêineres de abas fechadas não precisam mais ser observados.
    for (const [el, observer] of this.observers) {
      if (!alive.has(el)) {
        observer.disconnect();
        this.observers.delete(el);
      }
    }
  }

  /**
   * Ícones das pastas no caminho que o Obsidian mostra acima do título da aba
   * (Pasta / Subpasta). Pasta sem ícone fica como estava.
   */
  private paintBreadcrumbs(container: HTMLElement, file: TFile | null): void {
    const crumbs = [
      ...container.querySelectorAll<HTMLElement>(
        ":scope > .view-header-title-parent .view-header-breadcrumb"
      ),
    ];
    const folder = file?.parent;
    const segments = folder && !folder.isRoot() ? folder.path.split("/") : [];
    // O caminho vai de cima para baixo; alinhar pelo fim faz um caminho
    // encurtado pelo Obsidian ainda bater com as pastas certas.
    const offset = segments.length - crumbs.length;
    for (const [index, crumb] of crumbs.entries()) {
      const depth = index + offset;
      const path = depth < 0 ? "" : segments.slice(0, depth + 1).join("/");
      this.titles.add(crumb);
      paintTitleIcon(
        this.plugin.app,
        crumb,
        path ? this.plugin.folderIcon(path) : undefined,
        this.plugin.settings.twemoji
      );
    }
  }

  private observe(el: HTMLElement, delayedSweep: boolean): void {
    if (this.observers.has(el)) {
      return;
    }
    // As linhas novas são decoradas na mesma hora, ainda antes do frame: o
    // explorador refaz linhas ao clicar e rolar, e esperar deixava a linha
    // piscar sem fundo/ícone. Só o que foi adicionado é visitado aqui; a
    // passada completa fica espaçada. No cabeçalho da nota ela continua no
    // próximo frame, para o ícone não sumir.
    const observer = new MutationObserver((records) => {
      this.decorateAdded(records);
      if (delayedSweep) {
        this.scheduleSweep();
      } else {
        this.schedule();
      }
    });
    // O caminho também: nas pastas, o Obsidian insere a linha vazia e só
    // depois põe o nome e o `data-path`.
    observer.observe(el, {
      attributeFilter: ["data-path"],
      childList: true,
      subtree: true,
    });
    this.observers.set(el, observer);
  }

  private scheduleSweep(): void {
    if (this.sweepTimer !== null) {
      return;
    }
    this.sweepTimer = window.setTimeout(() => {
      this.sweepTimer = null;
      this.schedule();
    }, SWEEP_DELAY_MS);
  }

  /** Decora só as linhas que acabaram de entrar no DOM ou de ganhar o caminho. */
  private decorateAdded(records: MutationRecord[]): void {
    if (
      records.every(
        (record) =>
          record.type !== "attributes" && record.addedNodes.length === 0
      )
    ) {
      return;
    }
    measure("explorer.decorateAdded", () => {
      this.withPass(() => {
        for (const record of records) {
          const { target } = record;
          if (record.type === "attributes") {
            if (
              target.instanceOf(HTMLElement) &&
              target.matches(ROW_SELECTOR)
            ) {
              this.decorateTitle(target);
            }
            continue;
          }
          for (const node of record.addedNodes) {
            if (node.instanceOf(HTMLElement)) {
              this.decorateAddedNode(node);
            }
          }
        }
      });
    });
  }

  private decorateAddedNode(node: HTMLElement): void {
    // O próprio ícone inserido por esta passada não pede outra.
    if (node.hasClass(ICON_CLASS)) {
      return;
    }
    if (node.matches(ROW_SELECTOR)) {
      this.decorateTitle(node);
      return;
    }
    const parent = node.closest<HTMLElement>(ROW_SELECTOR);
    if (parent) {
      this.decorateTitle(parent);
      return;
    }
    for (const title of node.querySelectorAll<HTMLElement>(ROW_SELECTOR)) {
      this.decorateTitle(title);
    }
  }

  private decorateTitle(title: HTMLElement): void {
    const content = title.querySelector<HTMLElement>(ROW_CONTENT_SELECTOR);
    if (!content) {
      return;
    }
    const path = title.dataset.path ?? "";
    this.place(title, content, path);
    this.paintName(content, path);
    this.paintTreeCover(title, path);
  }

  private withPass<T>(fn: () => T): T {
    const previous = this.pass;
    this.pass = { data: new Map(), files: new Map() };
    try {
      return fn();
    } finally {
      this.pass = previous;
    }
  }

  /** Arquivo da nota, se ela existir. Guardado durante a passada. */
  private fileFor(path: string): TFile | null {
    const cache = this.pass?.files;
    if (cache?.has(path)) {
      return cache.get(path) ?? null;
    }
    const file = path ? this.plugin.app.vault.getFileByPath(path) : null;
    cache?.set(path, file);
    return file;
  }

  /** Dados do frontmatter da nota, se ela existir. Guardados durante a passada. */
  private dataFor(path: string): CoverData | null {
    const cache = this.pass?.data;
    if (cache?.has(path)) {
      return cache.get(path) ?? null;
    }
    const { app } = this.plugin;
    const file = this.fileFor(path);
    const data = file
      ? dataFromFrontmatter(app.metadataCache.getFileCache(file)?.frontmatter)
      : null;
    cache?.set(path, data);
    return data;
  }

  /** Ícone gravado no frontmatter da nota ou, numa pasta, nas configurações. */
  private iconFor(path: string): string | undefined {
    return this.dataFor(path)?.icon ?? this.plugin.folderIcon(path);
  }

  /** Pinta o nome da nota no explorador com a cor dela, se a opção estiver ligada. */
  private paintName(content: HTMLElement, path: string): void {
    const color = this.plugin.settings.nameColors
      ? this.dataFor(path)?.color
      : undefined;
    if (!color) {
      clearName(content);
      return;
    }
    content.style.color = iconColorCss(color);
    content.addClass(NAME_CLASS);
  }

  /**
   * Fundo da linha da nota no explorador: a miniatura da capa (ver
   * cover-thumbs.ts), só para capas com foto. Enquanto a miniatura é gerada, a
   * linha fica sem fundo; ela volta a ser pintada quando a miniatura chega.
   */
  private paintTreeCover(title: HTMLElement, path: string): void {
    const layer = treeCoverLayer(this.treeBackgroundFor(path));
    if (!layer) {
      clearTreeCover(title);
      return;
    }
    if (title.style.getPropertyValue(TREE_COVER_VAR) !== layer) {
      title.style.setProperty(TREE_COVER_VAR, layer);
      // Só a primeira aparição anima: o Obsidian refaz as linhas ao rolar e
      // clicar, e animar de novo a cada vez pareceria piscar.
      const seen = `${path}\n${layer}`;
      title.toggleClass("is-fresh", !this.shownBackgrounds.has(seen));
      this.shownBackgrounds.add(seen);
    }
    title.addClass(TREE_COVER_CLASS);
  }

  /** Imagem que vai no fundo do item: a própria imagem, ou a capa da nota. */
  private treeBackgroundFor(path: string): string | undefined {
    const mode = this.plugin.settings.treeBackgrounds;
    if (mode === "off" || !path) {
      return undefined;
    }
    const file = this.fileFor(path);
    if (!file) {
      return undefined;
    }
    if (isImageFile(file)) {
      return mode === "images" || mode === "both" ? file.path : undefined;
    }
    return mode === "notes" || mode === "both"
      ? this.dataFor(path)?.cover
      : undefined;
  }

  /** Põe, troca ou tira o ícone de `parent`, logo antes de `before`. */
  private place(parent: HTMLElement, before: HTMLElement, path: string): void {
    const value = this.iconFor(path);
    const existing = parent.querySelector<HTMLElement>(
      `:scope > .${ICON_CLASS}`
    );
    if (!value) {
      existing?.remove();
      return;
    }

    // O estilo do emoji e o corte das margens entram na chave para redesenhar
    // quando a opção muda.
    const { iconTrim, twemoji } = this.plugin.settings;
    const key = `${twemoji}\n${iconTrim}\n${iconPacksVersion()}\n${value}`;
    const placed =
      existing?.dataset.key === key && existing.nextElementSibling === before;
    if (placed) {
      return;
    }

    existing?.remove();
    const icon = createSpan({ cls: ICON_CLASS });
    icon.dataset.key = key;
    drawPageIcon(this.plugin.app, icon, value, this.plugin.settings.twemoji);
    before.before(icon);
  }
}
