import type { EmojiEntry } from "./emojis";

/** Lado do botão do emoji e espaço entre eles; iguais aos de `.mdp-icon-grid`. */
const CELL = 34;
const GAP = 2;
/** Altura de uma linha de emojis, contando o espaço até a próxima. */
const ROW_HEIGHT = CELL + GAP;
/** Altura do título de uma seção, com as margens de `.mdp-picker-section-title`. */
const TITLE_HEIGHT = 38;
/** Linhas desenhadas além da área visível, para a rolagem não mostrar buracos. */
const OVERSCAN = 4;

export interface GridSection {
  title: string;
  entries: readonly EmojiEntry[];
}

interface Row {
  top: number;
  title?: string;
  entries?: readonly EmojiEntry[];
}

type MakeButton = (row: HTMLElement, entry: EmojiEntry) => void;

/**
 * Grade de emojis virtualizada, como no Notion e no Discord: só existem no
 * DOM as linhas perto da área visível, umas poucas dezenas de botões em vez
 * de quase 2 mil. Ao rolar, as linhas que saem são guardadas e voltam prontas
 * (com as imagens já desenhadas) quando aparecem de novo.
 */
export class EmojiGrid {
  private readonly el: HTMLElement;
  private readonly scroller: HTMLElement;
  private readonly makeButton: MakeButton;
  private readonly resize: ResizeObserver;

  private sections: readonly GridSection[] = [];
  private rows: Row[] = [];
  private titleTops: number[] = [];
  private columns = 0;
  /** Linhas já montadas, pelo índice; ficam guardadas mesmo fora da tela. */
  private built = new Map<number, HTMLElement>();
  private shown = new Set<number>();

  constructor(parent: HTMLElement, scroller: HTMLElement, make: MakeButton) {
    this.el = parent.createDiv({ cls: "mdp-emoji-grid" });
    this.scroller = scroller;
    this.makeButton = make;
    // A largura só é conhecida depois do layout, e muda se a janela muda.
    this.resize = new ResizeObserver(() => {
      this.layout();
    });
    this.resize.observe(this.el);
  }

  /** Troca o conteúdo (seções completas ou resultados da busca). */
  setSections(sections: readonly GridSection[]): void {
    this.sections = sections;
    this.columns = 0;
    this.layout();
  }

  /** Mostra ou esconde a grade; ao voltar, as linhas guardadas reaparecem. */
  toggle(show: boolean): void {
    this.el.toggle(show);
    if (show) {
      this.layout();
    }
  }

  /** Posição de cada título de seção, relativa ao contêiner que rola. */
  sectionTops(): number[] {
    return this.titleTops.map((top) => top + this.el.offsetTop);
  }

  /** Desenha as linhas que entraram na área visível e tira as que saíram. */
  update(): void {
    if (this.rows.length === 0) {
      return;
    }
    const top = this.scroller.scrollTop - this.el.offsetTop;
    const bottom = top + this.scroller.clientHeight;
    const first = Math.max(0, this.rowAt(top) - OVERSCAN);
    const last = Math.min(this.rows.length - 1, this.rowAt(bottom) + OVERSCAN);

    for (const index of this.shown) {
      if (index < first || index > last) {
        this.built.get(index)?.detach();
        this.shown.delete(index);
      }
    }
    for (let index = first; index <= last; index += 1) {
      if (!this.shown.has(index)) {
        this.el.append(this.rowEl(index));
        this.shown.add(index);
      }
    }
  }

  destroy(): void {
    this.resize.disconnect();
    this.built.clear();
    this.shown.clear();
    this.el.remove();
  }

  /** Refaz as linhas quando o conteúdo ou o número de colunas muda. */
  private layout(): void {
    const width = this.el.clientWidth;
    if (width === 0) {
      return;
    }
    const columns = Math.max(1, Math.floor((width + GAP) / (CELL + GAP)));
    if (columns === this.columns) {
      this.update();
      return;
    }
    this.columns = columns;
    this.el.style.setProperty("--mdp-emoji-columns", String(columns));

    this.rows = [];
    this.titleTops = [];
    let top = 0;
    for (const section of this.sections) {
      this.titleTops.push(top);
      this.rows.push({ title: section.title, top });
      top += TITLE_HEIGHT;
      for (let start = 0; start < section.entries.length; start += columns) {
        this.rows.push({
          entries: section.entries.slice(start, start + columns),
          top,
        });
        top += ROW_HEIGHT;
      }
    }
    this.el.style.height = `${top}px`;

    this.el.empty();
    this.built = new Map();
    this.shown.clear();
    this.update();
  }

  /** Índice da última linha que começa em `y` ou antes (busca binária). */
  private rowAt(y: number): number {
    let low = 0;
    let high = this.rows.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if ((this.rows[mid]?.top ?? 0) <= y) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }

  private rowEl(index: number): HTMLElement {
    const cached = this.built.get(index);
    if (cached) {
      return cached;
    }
    const row = this.rows[index];
    const el = createDiv();
    el.style.top = `${row?.top ?? 0}px`;
    if (row?.title === undefined) {
      el.addClass("mdp-emoji-grid-row");
      for (const entry of row?.entries ?? []) {
        this.makeButton(el, entry);
      }
    } else {
      el.addClass("mdp-picker-section-title", "mdp-emoji-grid-title");
      el.setText(row.title);
    }
    this.built.set(index, el);
    return el;
  }
}
