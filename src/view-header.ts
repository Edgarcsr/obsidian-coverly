import { MarkdownView } from "obsidian";

import { buildHeader } from "./header";
import type MdPlusPlugin from "./main";
import { dataFromFrontmatter } from "./note-data";

type Mode = "source" | "preview";

const MODES: Mode[] = ["source", "preview"];

/** Onde o cabeçalho mora em cada modo da view. */
interface Slot {
  /** Contêiner que rola: a capa é esticada até as bordas dele. */
  scroller: HTMLElement;
  /** Elemento que recebe o cabeçalho, logo antes do título inline. */
  parent: HTMLElement;
  /** Elemento observado para detectar quando o Obsidian refaz o DOM. */
  sizer: HTMLElement;
}

interface ViewState {
  path: string | null;
  headers: Partial<Record<Mode, HTMLElement>>;
  observed: Set<HTMLElement>;
  mutations: MutationObserver[];
  resize: ResizeObserver;
}

const findSlot = (view: MarkdownView, mode: Mode): Slot | null => {
  if (mode === "source") {
    const scroller = view.contentEl.querySelector<HTMLElement>(
      ".markdown-source-view .cm-scroller"
    );
    const sizer = scroller?.querySelector<HTMLElement>(":scope > .cm-sizer");
    return scroller && sizer ? { parent: sizer, scroller, sizer } : null;
  }

  const scroller = view.contentEl.querySelector<HTMLElement>(
    ".markdown-preview-view"
  );
  const sizer = scroller?.querySelector<HTMLElement>(
    ":scope > .markdown-preview-sizer"
  );
  if (!scroller || !sizer) {
    return null;
  }
  // No modo de leitura o título inline fica dentro de `.mod-header`.
  const modHeader = sizer.querySelector<HTMLElement>(":scope > .mod-header");
  return { parent: modHeader ?? sizer, scroller, sizer };
};

/** O cabeçalho entra antes do título inline; sem título, no começo do conteúdo. */
const anchorIn = (parent: HTMLElement): Node | null => {
  const title = parent.querySelector(":scope > .inline-title");
  if (title) {
    return title;
  }
  // O "pusher" do modo de leitura controla a rolagem virtual e precisa continuar primeiro.
  const pusher = parent.querySelector(":scope > .markdown-preview-pusher");
  return pusher ? pusher.nextSibling : parent.firstChild;
};

const isPlaced = (header: HTMLElement, parent: HTMLElement): boolean => {
  if (header.parentElement !== parent) {
    return false;
  }
  const title = parent.querySelector(":scope > .inline-title");
  return !title || header.nextElementSibling === title;
};

/** Lê um valor de estilo em px ("-24px" → -24). Vazio vira 0. */
const pixels = (value: string): number => Number(value.replace("px", "")) || 0;

const clearState = (state: ViewState): void => {
  for (const header of Object.values(state.headers)) {
    header?.remove();
  }
  state.headers = {};
  state.path = null;
};

const disposeState = (state: ViewState): void => {
  clearState(state);
  state.resize.disconnect();
  for (const observer of state.mutations) {
    observer.disconnect();
  }
  state.mutations = [];
  state.observed.clear();
};

/**
 * Estica a capa até as bordas e o topo do contêiner que rola, ignorando o
 * padding e a largura de leitura do tema. A conta parte da margem atual, então
 * chamadas repetidas convergem sem precisar zerar o estilo (evita tremer na rolagem).
 */
const bleed = (header: HTMLElement, scroller: HTMLElement): void => {
  const cover = header.querySelector<HTMLElement>(":scope > .mdp-cover");
  if (!cover || scroller.clientWidth === 0) {
    return;
  }

  const frame = scroller.getBoundingClientRect();
  const rect = cover.getBoundingClientRect();
  const marginLeft = pixels(cover.style.marginLeft);
  const marginTop = pixels(cover.style.marginTop);

  const left = marginLeft - (rect.left - frame.left - scroller.clientLeft);
  const top =
    marginTop -
    (rect.top - frame.top - scroller.clientTop + scroller.scrollTop);
  const width = `${scroller.clientWidth}px`;

  if (Math.abs(left - marginLeft) > 0.5) {
    cover.style.marginLeft = `${left}px`;
  }
  if (Math.abs(top - marginTop) > 0.5) {
    cover.style.marginTop = `${top}px`;
  }
  if (cover.style.width !== width) {
    cover.style.width = width;
  }

  // Distância da coluna de texto até a borda direita: a pílula de ações se alinha a ela.
  const contentRight = `${Math.max(0, scroller.clientWidth + left - header.clientWidth)}px`;
  if (cover.style.getPropertyValue("--mdp-content-right") !== contentRight) {
    cover.style.setProperty("--mdp-content-right", contentRight);
  }
};

/**
 * Coloca capa + ícone em cada nota aberta, antes do título inline, nos modos de
 * edição e de leitura. O cabeçalho fica fora do documento do editor, por isso
 * consegue ocupar o topo inteiro como no Notion.
 */
export class HeaderManager {
  private readonly plugin: MdPlusPlugin;
  private readonly states = new Map<MarkdownView, ViewState>();
  private frame: number | null = null;

  constructor(plugin: MdPlusPlugin) {
    this.plugin = plugin;
  }

  /** Agrupa várias notificações (layout, metadados, DOM) num único frame. */
  schedule(): void {
    if (this.frame !== null) {
      return;
    }
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.syncAll();
    });
  }

  syncAll(): void {
    const alive = new Set<MarkdownView>();
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView) {
        alive.add(leaf.view);
        this.sync(leaf.view);
      }
    }
    for (const [view, state] of this.states) {
      if (!alive.has(view)) {
        disposeState(state);
        this.states.delete(view);
      }
    }
  }

  destroy(): void {
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    for (const state of this.states.values()) {
      disposeState(state);
    }
    this.states.clear();
  }

  private sync(view: MarkdownView): void {
    const state = this.stateFor(view);
    const { file } = view;
    if (!file) {
      clearState(state);
      return;
    }

    const data = dataFromFrontmatter(
      this.plugin.app.metadataCache.getFileCache(file)?.frontmatter
    );
    const key = `${file.path}\n${JSON.stringify(data)}`;
    // A animação de entrada só roda ao abrir a nota, não a cada mudança na capa.
    const entering = state.path !== file.path;
    state.path = file.path;

    for (const mode of MODES) {
      const slot = findSlot(view, mode);
      if (!slot) {
        continue;
      }
      this.watch(state, slot);

      let header = state.headers[mode];
      if (
        !header ||
        header.dataset.key !== key ||
        !isPlaced(header, slot.parent)
      ) {
        header?.remove();
        header = buildHeader(this.plugin, data, file.path, entering);
        header.dataset.key = key;
        slot.parent.insertBefore(header, anchorIn(slot.parent));
        state.headers[mode] = header;
      }
      bleed(header, slot.scroller);
    }
  }

  private stateFor(view: MarkdownView): ViewState {
    let state = this.states.get(view);
    if (!state) {
      state = {
        headers: {},
        mutations: [],
        observed: new Set(),
        path: null,
        resize: new ResizeObserver(() => {
          this.schedule();
        }),
      };
      this.states.set(view, state);
    }
    return state;
  }

  private watch(state: ViewState, slot: Slot): void {
    // Observar o mesmo elemento de novo é inofensivo para o ResizeObserver.
    state.resize.observe(slot.scroller);
    if (state.observed.has(slot.sizer)) {
      return;
    }
    const observer = new MutationObserver(() => {
      this.schedule();
    });
    observer.observe(slot.sizer, { childList: true });
    state.mutations.push(observer);
    state.observed.add(slot.sizer);
  }
}
