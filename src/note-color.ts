import { setTooltip } from "obsidian";

import { asyncListener } from "./async-listener";
import { openFloatingPopup } from "./floating-popup";
import type { PopupPosition } from "./floating-popup";
import { t } from "./i18n";
import {
  allowsCustomColor,
  iconColorCss,
  iconColors,
  isCustomColor,
} from "./page-icon";

export interface ColorPopupOptions {
  /** Cor atual da nota (id da paleta ou hexadecimal); vazio = a padrão. */
  current: string | undefined;
  position: PopupPosition;
  onPick: (color: string) => Promise<void>;
}

/** Id que, ao ser escolhido, tira a cor da nota. */
export const DEFAULT_COLOR = "default";

/**
 * Quadro com as cores dos ícones para escolher a do nome da nota no explorador.
 * Some ao escolher, ao clicar fora ou com Esc.
 */
export const showColorPopup = (options: ColorPopupOptions): void => {
  const current = options.current ?? DEFAULT_COLOR;

  openFloatingPopup("mdp-note-color", options.position, (popup, close) => {
    const grid = popup.createDiv({ cls: "mdp-color-grid" });

    const choose = async (id: string): Promise<void> => {
      close();
      await options.onPick(id);
    };

    for (const color of iconColors()) {
      const swatch = grid.createEl("button", {
        cls:
          color.id === current
            ? "mdp-color-swatch is-selected"
            : "mdp-color-swatch",
      });
      setTooltip(swatch, t(color.label));
      swatch.createSpan({ cls: "mdp-color-dot" }).style.background = color.css;
      swatch.addEventListener(
        "click",
        asyncListener(async () => {
          await choose(color.id);
        })
      );
    }

    if (!allowsCustomColor()) {
      return;
    }
    const custom = grid.createEl("button", {
      cls: isCustomColor(current)
        ? "mdp-color-swatch is-selected"
        : "mdp-color-swatch",
    });
    setTooltip(custom, t("color.custom"));
    const dot = custom.createSpan({ cls: "mdp-color-dot is-custom" });
    const input = custom.createEl("input", {
      cls: "mdp-color-input",
      type: "color",
    });
    if (isCustomColor(current)) {
      input.value = current;
      dot.style.background = iconColorCss(current);
    }
    custom.addEventListener("click", () => {
      input.click();
    });
    input.addEventListener(
      "change",
      asyncListener(async () => {
        await choose(input.value);
      })
    );
  });
};
