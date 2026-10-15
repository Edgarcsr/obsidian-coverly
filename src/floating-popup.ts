import { setIcon, setTooltip } from "obsidian";

import { asyncListener } from "./async-listener";
import { t } from "./i18n";

/** Distância mínima entre o quadro e as bordas da janela. */
const EDGE = 8;

export interface PopupPosition {
  x: number;
  y: number;
}

/**
 * Abre um quadro flutuante junto a `position`, dentro da janela. `fill` monta o
 * conteúdo e recebe a função que fecha o quadro, que também some ao clicar
 * fora ou com Esc. A aparência (fixo, borda, sombra) vem da classe
 * `mdp-color-palette`; `cls` acrescenta a do chamador.
 */
export const openFloatingPopup = (
  cls: string,
  position: PopupPosition,
  fill: (popup: HTMLElement, close: () => void) => void
): void => {
  const controller = new AbortController();
  const popup = document.body.createDiv({ cls: `mdp-color-palette ${cls}` });

  const close = (): void => {
    popup.remove();
    controller.abort();
  };

  fill(popup, close);

  const left = Math.min(
    position.x,
    window.innerWidth - popup.offsetWidth - EDGE
  );
  const top = Math.min(
    position.y,
    window.innerHeight - popup.offsetHeight - EDGE
  );
  popup.style.left = `${Math.max(EDGE, left)}px`;
  popup.style.top = `${Math.max(EDGE, top)}px`;

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!(event.target instanceof Node && popup.contains(event.target))) {
        close();
      }
    },
    { capture: true, signal: controller.signal }
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        close();
      }
    },
    { capture: true, signal: controller.signal }
  );
};

/**
 * Cabeçalho dos quadros: título à esquerda e, quando há o que tirar, a borracha
 * ("Remover") no canto direito.
 */
export const renderPopupHeader = (
  popup: HTMLElement,
  title: string,
  onRemove: (() => Promise<void>) | null,
  close: () => void
): void => {
  const header = popup.createDiv({ cls: "mdp-popup-header" });
  header.createSpan({ cls: "mdp-popup-title", text: title });
  if (!onRemove) {
    return;
  }
  // Um ícone: o texto "Remover" ficava pequeno demais no canto do quadro.
  const remove = header.createEl("button", {
    attr: { "aria-label": t("common.remove") },
    cls: "mdp-popup-remove",
  });
  setIcon(remove, "eraser");
  setTooltip(remove, t("common.remove"));
  remove.addEventListener(
    "click",
    asyncListener(async () => {
      close();
      await onRemove();
    })
  );
};
