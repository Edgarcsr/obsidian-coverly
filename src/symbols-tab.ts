import { asyncListener } from "./async-listener";
import { t } from "./i18n";
import { searchSymbols, symbolEntries, symbolValue } from "./symbols";
import type { SymbolEntry } from "./symbols";

export interface SymbolGrid {
  /** Mostra só os ícones que batem com a busca; vazia mostra todos. */
  filter: (query: string) => void;
  /** Os ícones à vista agora, para o botão de escolher ao acaso. */
  visible: () => readonly SymbolEntry[];
}

/**
 * Grade da aba Pastas: as cores em fileiras (normal, contorno, código) e os
 * temas embaixo. São poucos ícones, então ficam todos no DOM e a busca só
 * esconde os que não batem.
 */
export const renderSymbolGrid = (
  parent: HTMLElement,
  current: string | undefined,
  pick: (value: string) => Promise<void>
): SymbolGrid => {
  parent.createDiv({
    cls: "mdp-picker-section-title",
    text: t("tab.folders"),
  });
  const grid = parent.createDiv({ cls: "mdp-icon-grid is-symbols" });
  const empty = parent.createDiv({
    cls: "mdp-picker-hint is-empty",
    text: t("iconPicker.noIcons"),
  });

  const buttons = new Map<string, HTMLElement>();
  for (const entry of symbolEntries()) {
    const value = symbolValue(entry.id);
    const button = grid.createEl("button", {
      attr: { "aria-label": entry.id },
      cls:
        value === current ? "mdp-icon-option is-selected" : "mdp-icon-option",
    });
    button.createEl("img", { attr: { alt: "", src: entry.url } });
    button.addEventListener(
      "click",
      asyncListener(async () => {
        await pick(value);
      })
    );
    buttons.set(entry.id, button);
  }

  let visible: readonly SymbolEntry[] = symbolEntries();
  const filter = (query: string): void => {
    visible = query.trim() ? searchSymbols(query) : symbolEntries();
    const shown = new Set(visible.map((entry) => entry.id));
    for (const [id, button] of buttons) {
      button.toggle(shown.has(id));
    }
    empty.toggle(visible.length === 0);
  };
  filter("");

  return { filter, visible: () => visible };
};
