import { setTooltip } from "obsidian";

import { t } from "./i18n";
import {
  drawLucide,
  iconColorCss,
  iconColors,
  isCustomColor,
} from "./page-icon";

/** Cor e preferência da aba Ícones, compartilhadas entre a paleta e a grade. */
export interface ColorState {
  color: string;
  /** Ao clicar num ícone, mostra as variantes de cor em vez de escolher direto. */
  askColor: boolean;
}

export interface ColorPaletteOptions {
  row: HTMLElement;
  grid: HTMLElement;
  state: ColorState;
  onColorChange: (color: string) => Promise<void>;
  onAskColorChange: (askColor: boolean) => Promise<void>;
}

/** Interruptor no visual do Obsidian (a mesma classe dos toggles das configurações). */
const toggle = (
  parent: HTMLElement,
  enabled: boolean,
  onChange: (enabled: boolean) => Promise<void>
): void => {
  const container = parent.createDiv({ cls: "checkbox-container" });
  container.toggleClass("is-enabled", enabled);
  container.addEventListener("click", async () => {
    const next = !container.hasClass("is-enabled");
    container.toggleClass("is-enabled", next);
    await onChange(next);
  });
};

/** Espaço mínimo entre os quadros e as bordas da janela. */
const EDGE = 8;
const ANCHOR_GAP = 4;

/**
 * Posiciona `el` (já `position: fixed`) junto ao `anchor`, dentro da janela:
 * abaixo dele, ou acima se faltar espaço, e com rolagem se não couber em nenhum.
 */
const placeFixed = (
  el: HTMLElement,
  anchor: HTMLElement,
  align: "start" | "end"
): void => {
  const rect = anchor.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - ANCHOR_GAP - EDGE;
  const above = rect.top - ANCHOR_GAP - EDGE;
  el.style.maxHeight = "";
  const height = el.offsetHeight;
  const useAbove = height > below && above > below;
  const room = Math.max(useAbove ? above : below, 0);
  el.style.maxHeight = `${room}px`;
  const shown = Math.min(height, room);
  el.style.top = `${
    useAbove ? rect.top - ANCHOR_GAP - shown : rect.bottom + ANCHOR_GAP
  }px`;

  const width = el.offsetWidth;
  const left = align === "end" ? rect.right - width : rect.left;
  el.style.left = `${Math.max(
    EDGE,
    Math.min(left, window.innerWidth - width - EDGE)
  )}px`;
};

/**
 * Bolinha da cor atual ao lado da busca. Abre a paleta com as cores do
 * Tailwind, uma opção para escolher qualquer cor e o "Perguntar sempre".
 */
export const renderColorButton = (options: ColorPaletteOptions): void => {
  const { row, grid, state } = options;
  const button = row.createEl("button", { cls: "mdp-picker-square" });
  setTooltip(button, t("color.tooltip"));
  const dot = button.createSpan({ cls: "mdp-color-dot" });

  const palette = row.createDiv({ cls: "mdp-color-palette" });
  palette.hide();
  const colors = palette.createDiv({ cls: "mdp-color-grid" });
  const swatches: HTMLElement[] = [];

  /** Mostra a cor na bolinha e na grade, sem gravar. */
  const preview = (id: string): void => {
    const css = iconColorCss(id);
    dot.style.background = css;
    grid.style.color = css;
  };

  const apply = async (id: string, swatch: HTMLElement): Promise<void> => {
    state.color = id;
    preview(id);
    for (const other of swatches) {
      other.toggleClass("is-selected", other === swatch);
    }
    palette.hide();
    await options.onColorChange(id);
  };

  for (const color of iconColors()) {
    const swatch = colors.createEl("button", {
      cls:
        color.id === state.color
          ? "mdp-color-swatch is-selected"
          : "mdp-color-swatch",
    });
    setTooltip(swatch, t(color.label));
    swatch.createSpan({ cls: "mdp-color-dot" }).style.background = color.css;
    swatch.addEventListener("click", async () => {
      await apply(color.id, swatch);
    });
    swatches.push(swatch);
  }

  // Última opção: o seletor de cor do sistema. O anel colorido indica que é
  // livre; depois de escolhida, a bolinha mostra a própria cor.
  const custom = colors.createEl("button", {
    cls: isCustomColor(state.color)
      ? "mdp-color-swatch is-selected"
      : "mdp-color-swatch",
  });
  setTooltip(custom, t("color.custom"));
  const customDot = custom.createSpan({ cls: "mdp-color-dot is-custom" });
  // Invisível, mas com posição: o seletor do sistema abre ancorado nele, e
  // com display: none abriria no canto da janela.
  const input = custom.createEl("input", {
    cls: "mdp-color-input",
    type: "color",
  });
  const showCustom = (id: string): void => {
    customDot.style.background = isCustomColor(id) ? id : "";
  };
  if (isCustomColor(state.color)) {
    input.value = state.color;
    showCustom(state.color);
  }
  swatches.push(custom);

  custom.addEventListener("click", () => {
    input.click();
  });
  // Enquanto arrasta no seletor do sistema, só pré-visualiza; grava ao confirmar.
  input.addEventListener("input", () => {
    preview(input.value);
    showCustom(input.value);
  });
  input.addEventListener("change", async () => {
    await apply(input.value, custom);
  });

  const ask = palette.createDiv({ cls: "mdp-color-ask" });
  ask.createSpan({ text: t("color.askAlways") });
  toggle(ask, state.askColor, async (enabled) => {
    state.askColor = enabled;
    await options.onAskColorChange(enabled);
  });

  preview(state.color);
  button.addEventListener("click", () => {
    const show = !palette.isShown();
    palette.toggle(show);
    if (show) {
      placeFixed(palette, button, "end");
    }
  });
};

/**
 * Quadro sobre o ícone clicado, com ele em cada cor da paleta (e na cor
 * personalizada, se houver uma). Devolve a função que o fecha.
 */
export const showColorVariants = (
  body: HTMLElement,
  target: HTMLElement,
  name: string,
  state: ColorState,
  onPick: (color: string) => Promise<void>
): (() => void) => {
  const ids = iconColors().map((color) => color.id);
  // A cor atual continua à mão mesmo sendo de outra paleta ou personalizada.
  if (!ids.includes(state.color)) {
    ids.push(state.color);
  }

  const panel = body.createDiv({ cls: "mdp-color-variants" });
  for (const id of ids) {
    const variant = panel.createEl("button", {
      cls:
        id === state.color ? "mdp-icon-option is-selected" : "mdp-icon-option",
    });
    variant.style.color = iconColorCss(id);
    drawLucide(variant, name);
    variant.addEventListener("click", async () => {
      await onPick(id);
    });
  }

  placeFixed(panel, target, "start");

  const controller = new AbortController();
  const close = (): void => {
    panel.remove();
    controller.abort();
  };
  // Posicionado pela janela: rolar a grade o deixaria longe do ícone.
  body.addEventListener("scroll", close, {
    once: true,
    signal: controller.signal,
  });
  // Clicar fora do quadro o fecha; clicar em outro ícone já abre o dele.
  body.addEventListener(
    "pointerdown",
    (event) => {
      if (!(event.target instanceof Node && panel.contains(event.target))) {
        close();
      }
    },
    { capture: true, signal: controller.signal }
  );
  return close;
};
