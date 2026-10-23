import { Platform, TFile, TFolder } from "obsidian";
import type { Menu, TAbstractFile } from "obsidian";

import { t } from "./i18n";
import type CoverlyPlugin from "./main";

/** Linha do item no explorador, para o seletor abrir junto dela. */
const explorerRow = (
  plugin: CoverlyPlugin,
  file: TAbstractFile
): HTMLElement | null => {
  // No celular o explorador é uma gaveta que fecha: o seletor abre no centro.
  if (Platform.isMobile) {
    return null;
  }
  const selector = `.nav-file-title[data-path="${CSS.escape(file.path)}"], .nav-folder-title[data-path="${CSS.escape(file.path)}"]`;
  for (const leaf of plugin.app.workspace.getLeavesOfType("file-explorer")) {
    const row = leaf.view.containerEl.querySelector<HTMLElement>(selector);
    if (row) {
      return row;
    }
  }
  return null;
};

const addIconItems = (
  menu: Menu,
  hasIcon: boolean,
  change: () => void,
  remove: () => void
): void => {
  menu.addItem((item) => {
    item.setTitle(t("menu.changeIcon")).setIcon("smile").onClick(change);
  });
  if (hasIcon) {
    menu.addItem((item) => {
      item.setTitle(t("menu.removeIcon")).setIcon("x").onClick(remove);
    });
  }
};

/**
 * Menu de contexto de notas e pastas: mudar e remover o ícone sem abrir a
 * nota. O da nota vai para o frontmatter; o da pasta, para as configurações.
 */
export const registerFileMenu = (plugin: CoverlyPlugin): void => {
  plugin.registerEvent(
    plugin.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof TFolder && !file.isRoot()) {
        addIconItems(
          menu,
          plugin.folderIcon(file.path) !== undefined,
          () => {
            void plugin.openFolderIconPicker(
              file.path,
              explorerRow(plugin, file)
            );
          },
          () => {
            void plugin.setFolderIcon(file.path, null);
          }
        );
        return;
      }
      if (file instanceof TFile && file.extension === "md") {
        addIconItems(
          menu,
          plugin.noteIcon(file.path) !== undefined,
          () => {
            void plugin.openIconPicker(file.path, explorerRow(plugin, file));
          },
          () => {
            void plugin.setIcon(file.path, null);
          }
        );
      }
    })
  );
};
