import { asyncListener } from "./async-listener";
import { openFloatingPopup } from "./floating-popup";
import type { PopupPosition } from "./floating-popup";
import { t } from "./i18n";
import type { MessageKey } from "./i18n";

/** Fontes que dá para escolher por nota. A padrão é a do tema (sem propriedade). */
export const NOTE_FONTS = ["default", "serif", "mono"] as const;

export type NoteFont = (typeof NOTE_FONTS)[number];

/** Fontes gravadas na nota: "default" é a ausência da propriedade. */
export type StoredFont = Exclude<NoteFont, "default">;

const LABELS: Record<NoteFont, MessageKey> = {
  default: "font.default",
  mono: "font.mono",
  serif: "font.serif",
};

const CLASS_PREFIX = "mdp-font-";

export const isStoredFont = (value: unknown): value is StoredFont =>
  value === "serif" || value === "mono";

/** Troca a fonte de `el` (a área de conteúdo da view); sem `font`, volta à do tema. */
export const applyFont = (el: HTMLElement, font?: StoredFont): void => {
  for (const name of NOTE_FONTS) {
    el.toggleClass(`${CLASS_PREFIX}${name}`, name === font);
  }
};

export interface FontPopupOptions {
  current: StoredFont | undefined;
  position: PopupPosition;
  onPick: (font: NoteFont) => Promise<void>;
}

/** Quadro "Estilo da fonte", como no Notion: cada opção mostra um "Ag" na própria fonte. */
export const showFontPopup = (options: FontPopupOptions): void => {
  const current = options.current ?? "default";

  openFloatingPopup("mdp-font-popup", options.position, (popup, close) => {
    popup.createDiv({ cls: "mdp-font-popup-title", text: t("font.title") });
    const row = popup.createDiv({ cls: "mdp-font-options" });

    for (const font of NOTE_FONTS) {
      const option = row.createEl("button", {
        cls:
          font === current ? "mdp-font-option is-selected" : "mdp-font-option",
      });
      option.createSpan({ cls: `mdp-font-sample is-${font}`, text: "Ag" });
      option.createSpan({ cls: "mdp-font-label", text: t(LABELS[font]) });
      option.addEventListener(
        "click",
        asyncListener(async () => {
          close();
          await options.onPick(font);
        })
      );
    }
  });
};
