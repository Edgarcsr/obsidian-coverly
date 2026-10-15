import { Menu } from "obsidian";

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

/** Troca a fonte de `el` (a área de conteúdo da view); `undefined` volta à do tema. */
export const applyFont = (el: HTMLElement, font?: StoredFont): void => {
  for (const name of NOTE_FONTS) {
    el.toggleClass(`${CLASS_PREFIX}${name}`, name === font);
  }
};

export interface FontMenuOptions {
  current: StoredFont | undefined;
  position: { x: number; y: number };
  onPick: (font: NoteFont) => Promise<void>;
}

/** Menu com as opções de fonte, a atual marcada. */
export const showFontMenu = (options: FontMenuOptions): void => {
  const menu = new Menu();
  for (const font of NOTE_FONTS) {
    menu.addItem((item) => {
      item
        .setTitle(t(LABELS[font]))
        .setChecked((options.current ?? "default") === font)
        .onClick(() => {
          void options.onPick(font);
        });
    });
  }
  menu.showAtPosition(options.position);
};
