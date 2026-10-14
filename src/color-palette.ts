import { setTooltip } from "obsidian";

import { ICON_COLORS, drawLucide, iconColorCss, isCustomColor } from "./page-icon";

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

/**
 * Bolinha da cor atual ao lado da busca. Abre a paleta com as cores do
 * Tailwind, uma opção para escolher qualquer cor e o "Perguntar sempre".
 */
export const renderColorButton = (options: ColorPaletteOptions): void => {
  const { row, grid, state } = options;
  const button = row.createEl("button", { cls: "mdp-picker-square" });
  setTooltip(button, "Cor do ícone");
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

  for (const color of ICON_COLORS) {
    const swatch = colors.createEl("button", {
      cls:
        color.id === state.color
          ? "mdp-color-swatch is-selected"
          : "mdp-color-swatch",
    });
    setTooltip(swatch, color.label);
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
  setTooltip(custom, "Escolher outra cor");
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
  ask.createSpan({ text: "Perguntar sempre" });
  toggle(ask, state.askColor, async (enabled) => {
    state.askColor = enabled;
    await options.onAskColorChange(enabled);
  });

  preview(state.color);
  button.addEventListener("click", () => {
    palette.toggle(!palette.isShown());
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
  const ids = ICON_COLORS.map((color) => color.id);
  if (isCustomColor(state.color)) {
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

  // Abre logo abaixo do ícone, sem passar da borda direita da área rolável.
  const left = Math.min(
    target.offsetLeft,
    body.clientWidth - panel.offsetWidth - 8
  );
  panel.style.left = `${Math.max(8, left)}px`;
  panel.style.top = `${target.offsetTop + target.offsetHeight + 4}px`;

  const controller = new AbortController();
  const close = (): void => {
    panel.remove();
    controller.abort();
  };
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
