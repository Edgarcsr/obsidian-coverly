import { MarkdownView } from "obsidian";
import type { HeadingCache } from "obsidian";

import type CoverlyPlugin from "./main";

/** Abaixo disso a nota não tem o que navegar e o sumário fica oculto. */
const MIN_HEADINGS = 2;
/** Linhas de folga: o título que acabou de chegar ao topo já conta como atual. */
const ACTIVE_OFFSET = 2;
/** Distância do fim da rolagem, em px, a partir da qual o último título fica ativo. */
const BOTTOM_SLACK = 4;

const WIKILINK = /\[\[(?<target>[^\]|]*)(?:\|(?<alias>[^\]]*))?\]\]/gu;
const MD_LINK = /\[(?<text>[^\]]*)\]\([^)]*\)/gu;
const MARKUP = /[*_`~=]/gu;

/** Tira a marcação do título para mostrar só o texto ("[[a|b]]" → "b"). */
const plainText = (heading: string): string =>
  heading
    .replace(WIKILINK, (_, target: string, alias?: string) => alias ?? target)
    .replace(MD_LINK, "$<text>")
    .replace(MARKUP, "")
    .trim();

interface TocState {
  el: HTMLElement;
  lines: HTMLElement[];
  items: HTMLElement[];
  headings: HeadingCache[];
  /** Muda quando os títulos mudam; evita redesenhar à toa. */
  key: string;
  active: number;
  onScroll: () => void;
}

const disposeState = (view: MarkdownView, state: TocState): void => {
  view.contentEl.removeEventListener("scroll", state.onScroll, true);
  state.el.remove();
};

/** O que rola na view: o editor ou o modo de leitura, o que estiver visível. */
const scrollerOf = (view: MarkdownView): HTMLElement | null =>
  view.contentEl.querySelector<HTMLElement>(
    view.getMode() === "source"
      ? ".markdown-source-view .cm-scroller"
      : ".markdown-preview-view"
  );

/** Índice do título em que a leitura está: o último que já passou do topo. */
const activeIndex = (view: MarkdownView, headings: HeadingCache[]): number => {
  const scroller = scrollerOf(view);
  if (
    scroller &&
    scroller.scrollTop > 0 &&
    scroller.scrollTop + scroller.clientHeight >=
      scroller.scrollHeight - BOTTOM_SLACK
  ) {
    return headings.length - 1;
  }
  const top = view.currentMode.getScroll() + ACTIVE_OFFSET;
  let active = 0;
  for (const [index, heading] of headings.entries()) {
    if (heading.position.start.line > top) {
      break;
    }
    active = index;
  }
  return active;
};

/** Destaca o traço e o item do título atual. */
const updateActive = (view: MarkdownView, state: TocState): void => {
  const active = activeIndex(view, state.headings);
  if (active === state.active) {
    return;
  }
  state.lines[state.active]?.removeClass("is-active");
  state.items[state.active]?.removeClass("is-active");
  state.lines[active]?.addClass("is-active");
  state.items[active]?.addClass("is-active");
  state.active = active;
};

/** Monta os traços e o cartão de títulos dentro da view. */
const buildToc = (
  view: MarkdownView,
  headings: HeadingCache[],
  key: string
): TocState => {
  // Os níveis ficam relativos ao menor título da nota: só H2 e H3 viram 1 e 2.
  const minLevel = Math.min(...headings.map((h) => h.level));

  const el = view.contentEl.createDiv({ cls: "mdp-toc" });
  const linesEl = el.createDiv({ cls: "mdp-toc-lines" });
  const panel = el.createDiv({ cls: "mdp-toc-panel" });

  const lines: HTMLElement[] = [];
  const items: HTMLElement[] = [];
  for (const heading of headings) {
    const depth = Math.min(heading.level - minLevel, 3);
    lines.push(
      linesEl.createDiv({
        attr: { "data-depth": String(depth) },
        cls: "mdp-toc-line",
      })
    );
    const item = panel.createDiv({
      attr: { "data-depth": String(depth) },
      cls: "mdp-toc-item",
      text: plainText(heading.heading) || "Sem título",
    });
    item.addEventListener("click", () => {
      view.currentMode.applyScroll(heading.position.start.line);
    });
    items.push(item);
  }

  const state: TocState = {
    active: -1,
    el,
    headings,
    items,
    key,
    lines,
    onScroll: () => {
      updateActive(view, state);
    },
  };
  // O evento de rolagem não sobe pelo DOM; na fase de captura ele chega aqui.
  view.contentEl.addEventListener("scroll", state.onScroll, true);
  return state;
};

/**
 * Sumário na lateral direita de cada nota, como no Notion: um traço por
 * título, com o da seção atual em destaque. Com o mouse por cima, abre a
 * lista dos títulos; clicar num deles rola a nota até ele.
 */
export class TocManager {
  private readonly plugin: CoverlyPlugin;
  private readonly states = new Map<MarkdownView, TocState>();
  private frame: number | null = null;

  constructor(plugin: CoverlyPlugin) {
    this.plugin = plugin;
  }

  /** Agrupa várias notificações (layout, metadados) num único frame. */
  schedule(): void {
    if (this.frame !== null) {
      return;
    }
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.syncAll();
    });
  }

  destroy(): void {
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    for (const [view, state] of this.states) {
      disposeState(view, state);
    }
    this.states.clear();
  }

  private syncAll(): void {
    const alive = new Set<MarkdownView>();
    if (this.plugin.settings.toc) {
      for (const leaf of this.plugin.app.workspace.getLeavesOfType(
        "markdown"
      )) {
        if (leaf.view instanceof MarkdownView) {
          alive.add(leaf.view);
          this.sync(leaf.view);
        }
      }
    }
    for (const [view, state] of this.states) {
      if (!alive.has(view)) {
        disposeState(view, state);
        this.states.delete(view);
      }
    }
  }

  private sync(view: MarkdownView): void {
    const { file } = view;
    const headings = file
      ? (this.plugin.app.metadataCache.getFileCache(file)?.headings ?? [])
      : [];
    const state = this.states.get(view);

    if (headings.length < MIN_HEADINGS) {
      if (state) {
        disposeState(view, state);
        this.states.delete(view);
      }
      return;
    }

    const key = JSON.stringify(
      headings.map((h) => [h.level, h.heading, h.position.start.line])
    );
    if (state?.key === key && state.el.parentElement === view.contentEl) {
      updateActive(view, state);
      return;
    }
    if (state) {
      disposeState(view, state);
    }
    const next = buildToc(view, headings, key);
    this.states.set(view, next);
    updateActive(view, next);
  }
}
