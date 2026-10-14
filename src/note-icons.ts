import { MarkdownView } from "obsidian";

import type CoverlyPlugin from "./main";
import { dataFromFrontmatter } from "./note-data";
import { drawPageIcon } from "./page-icon";
import { clearTitleIcon, paintTitleIcon } from "./title-icon";

const ICON_CLASS = "mdp-inline-icon";

/**
 * Ícone da nota, em miniatura, onde o nome dela aparece fora do cabeçalho:
 * no título da barra superior da aba (ver title-icon.ts) e no explorador de
 * arquivos, como no Notion.
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

  destroy(): void {
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
    for (const icon of document.querySelectorAll(`.${ICON_CLASS}`)) {
      icon.remove();
    }
    for (const title of this.titles) {
      clearTitleIcon(title);
    }
    this.titles.clear();
  }

  private decorateAll(): void {
    const { workspace } = this.plugin.app;
    const alive = new Set<HTMLElement>();

    for (const leaf of workspace.getLeavesOfType("file-explorer")) {
      const root = leaf.view.containerEl;
      alive.add(root);
      this.observe(root);
      for (const title of root.querySelectorAll<HTMLElement>(
        ".nav-file-title[data-path]"
      )) {
        const content = title.querySelector<HTMLElement>(
          ":scope > .nav-file-title-content"
        );
        if (content) {
          this.place(title, content, title.dataset.path ?? "");
        }
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
      this.observe(container);
      this.titles.add(title);
      paintTitleIcon(
        this.plugin.app,
        title,
        this.iconFor(view.file?.path ?? ""),
        this.plugin.settings.twemoji
      );
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

  private observe(el: HTMLElement): void {
    if (this.observers.has(el)) {
      return;
    }
    const observer = new MutationObserver(() => {
      this.schedule();
    });
    observer.observe(el, { childList: true, subtree: true });
    this.observers.set(el, observer);
  }

  /** Ícone gravado no frontmatter da nota, se houver. */
  private iconFor(path: string): string | undefined {
    const { app } = this.plugin;
    const file = path ? app.vault.getFileByPath(path) : null;
    if (!file) {
      return undefined;
    }
    return dataFromFrontmatter(
      app.metadataCache.getFileCache(file)?.frontmatter
    ).icon;
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

    // O estilo do emoji entra na chave para redesenhar quando a opção muda.
    const key = `${this.plugin.settings.twemoji}\n${value}`;
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
