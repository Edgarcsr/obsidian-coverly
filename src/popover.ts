import { setIcon } from "obsidian";

import { t } from "./i18n";

/**
 * Campo de busca com lupa. A borda fica no contêiner, não no `input`, para os
 * estilos de campo do Obsidian e dos temas não a cortarem.
 */
export const searchField = (
  parent: HTMLElement,
  placeholder: string
): HTMLInputElement => {
  const field = parent.createDiv({ cls: "mdp-search-field" });
  setIcon(field.createSpan({ cls: "mdp-search-field-icon" }), "search");
  return field.createEl("input", {
    attr: { spellcheck: "false" },
    placeholder,
    type: "text",
  });
};

/** Distância entre o botão que abriu e o popover. */
const GAP = 6;
/** Altura máxima do popover, a mesma do CSS (`.mdp-picker`). */
const MAX_HEIGHT = 480;
/** Abaixo disso de espaço embaixo do botão, o popover abre acima dele. */
const MIN_BELOW = 240;
/** Espaço mínimo entre o popover e as bordas da janela. */
const MARGIN = 8;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export interface PopoverTab<T extends string> {
  id: T;
  label: string;
  /** Caminho SVG (viewBox 32×32) mostrado antes do nome da aba. */
  icon?: string;
}

/**
 * Popover com abas, ancorado no botão que o abriu, como no Notion. Fecha ao
 * clicar fora ou com Esc. As subclasses só desenham o conteúdo de cada aba.
 */
export abstract class TabbedPopover<T extends string> {
  onClose: (() => void) | null = null;

  protected readonly el: HTMLElement;
  protected readonly body: HTMLElement;
  /** Barra fixa abaixo do conteúdo; fica oculta, a aba que precisar a preenche. */
  protected readonly footer: HTMLElement;
  protected tab: T;

  private readonly anchor: HTMLElement | null;
  private readonly tabsEl: HTMLElement;
  private readonly tabs: readonly PopoverTab<T>[];

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.target instanceof Node && this.el.contains(event.target)) {
      return;
    }
    this.close();
  };

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  };

  private readonly onResize = (): void => {
    this.place();
  };

  constructor(
    anchor: HTMLElement | null,
    tabs: readonly PopoverTab<T>[],
    initial: T,
    className: string
  ) {
    this.anchor = anchor;
    this.tabs = tabs;
    this.tab = initial;
    this.el = document.createElement("div");
    this.el.addClass("mdp-picker", className);
    this.tabsEl = this.el.createDiv({ cls: "mdp-picker-tabs" });
    this.body = this.el.createDiv({ cls: "mdp-picker-body" });
    this.footer = this.el.createDiv({ cls: "mdp-picker-footer" });
  }

  open(): void {
    document.body.append(this.el);
    this.renderTabs();
    this.renderBody();
    this.place();
    document.addEventListener("pointerdown", this.onPointerDown, true);
    document.addEventListener("keydown", this.onKeydown, true);
    window.addEventListener("resize", this.onResize);
  }

  close(): void {
    if (!this.el.isConnected) {
      return;
    }
    this.el.remove();
    document.removeEventListener("pointerdown", this.onPointerDown, true);
    document.removeEventListener("keydown", this.onKeydown, true);
    window.removeEventListener("resize", this.onResize);
    this.onClose?.();
  }

  /** Conteúdo da aba ativa, desenhado em `this.body` já vazio. */
  protected abstract renderTab(tab: T): void;

  /** "Remover" à direita das abas, quando existe algo para remover. */
  protected abstract hasRemove(): boolean;

  protected abstract remove(): Promise<void>;

  protected renderTabs(): void {
    this.tabsEl.empty();
    for (const tab of this.tabs) {
      const button = this.tabsEl.createEl("button", {
        cls:
          tab.id === this.tab ? "mdp-picker-tab is-active" : "mdp-picker-tab",
      });
      if (tab.icon) {
        button
          .createSvg("svg", {
            attr: { "aria-hidden": "true", viewBox: "0 0 32 32" },
            cls: "mdp-picker-tab-icon",
          })
          .createSvg("path", { attr: { d: tab.icon } });
      }
      button.createSpan({ text: tab.label });
      button.addEventListener("click", () => {
        this.tab = tab.id;
        this.renderTabs();
        this.renderBody();
      });
    }

    if (this.hasRemove()) {
      const remove = this.tabsEl.createEl("button", {
        cls: "mdp-picker-tab mdp-picker-remove",
        text: t("common.remove"),
      });
      remove.addEventListener("click", async () => {
        this.close();
        await this.remove();
      });
    }
  }

  protected renderBody(): void {
    this.body.empty();
    this.body.scrollTop = 0;
    this.footer.empty();
    this.footer.hide();
    // A altura acompanha o conteúdo da aba, então a posição é refeita no fim.
    window.requestAnimationFrame(() => {
      this.place();
    });
    this.renderTab(this.tab);
  }

  /**
   * Abre embaixo do botão, começando na borda esquerda dele. Em vez de subir
   * por cima do botão, encolhe para caber no espaço de baixo (o corpo rola);
   * só abre acima se embaixo sobrar muito pouco.
   */
  private place(): void {
    this.el.style.maxHeight = "";
    const width = this.el.offsetWidth;
    let height = this.el.offsetHeight;
    let left = (window.innerWidth - width) / 2;
    let top = window.innerHeight * 0.15;

    if (this.anchor?.isConnected) {
      const rect = this.anchor.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - GAP - MARGIN;
      const above = rect.top - GAP - MARGIN;
      const useAbove = below < MIN_BELOW && above > below;
      const room = Math.min(useAbove ? above : below, MAX_HEIGHT);
      this.el.style.maxHeight = `${Math.max(room, 0)}px`;
      height = Math.min(height, room);
      left = rect.left;
      top = useAbove ? rect.top - GAP - height : rect.bottom + GAP;
    }

    this.el.style.left = `${clamp(left, MARGIN, window.innerWidth - width - MARGIN)}px`;
    this.el.style.top = `${clamp(top, MARGIN, window.innerHeight - height - MARGIN)}px`;
  }
}
