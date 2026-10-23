import { TFolder } from "obsidian";
import type { TAbstractFile } from "obsidian";

import { asyncListener } from "./async-listener";
import type CoverlyPlugin from "./main";

/**
 * Ícones das pastas. Pasta não tem frontmatter, então o ícone fica nas
 * configurações do plugin, pelo caminho da pasta, no mesmo formato do ícone
 * da nota. Renomear, mover ou apagar a pasta leva junto as entradas dela e
 * das subpastas.
 */
export type FolderIcons = Record<string, string>;

/** Ícone da pasta. Só as chaves do próprio objeto: "constructor" não é pasta com ícone. */
export const folderIcon = (
  icons: FolderIcons,
  path: string
): string | undefined => {
  const value: unknown = Object.getOwnPropertyDescriptor(icons, path)?.value;
  return typeof value === "string" ? value : undefined;
};

/** A própria pasta ou uma de dentro dela. */
const isInside = (path: string, folder: string): boolean =>
  path === folder || path.startsWith(`${folder}/`);

/** Troca o começo dos caminhos que estavam em `from`. Diz se algo mudou. */
const moveFolderIcons = (
  icons: FolderIcons,
  from: string,
  to: string
): boolean => {
  let changed = false;
  for (const [path, value] of Object.entries(icons)) {
    if (isInside(path, from)) {
      Reflect.deleteProperty(icons, path);
      icons[`${to}${path.slice(from.length)}`] = value;
      changed = true;
    }
  }
  return changed;
};

/** Tira os ícones da pasta e das subpastas. Diz se algo mudou. */
const removeFolderIcons = (icons: FolderIcons, folder: string): boolean => {
  let changed = false;
  for (const path of Object.keys(icons)) {
    if (isInside(path, folder)) {
      Reflect.deleteProperty(icons, path);
      changed = true;
    }
  }
  return changed;
};

/** Mantém os ícones das pastas em dia quando elas são renomeadas, movidas ou apagadas. */
export const registerFolderIconSync = (plugin: CoverlyPlugin): void => {
  const { vault } = plugin.app;
  const save = async (changed: boolean): Promise<void> => {
    if (changed) {
      await plugin.saveSettings();
      plugin.refreshHeaders();
    }
  };
  plugin.registerEvent(
    vault.on(
      "rename",
      asyncListener(async (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFolder) {
          const { folderIcons } = plugin.settings;
          await save(moveFolderIcons(folderIcons, oldPath, file.path));
        }
      })
    )
  );
  plugin.registerEvent(
    vault.on(
      "delete",
      asyncListener(async (file: TAbstractFile) => {
        if (file instanceof TFolder) {
          await save(removeFolderIcons(plugin.settings.folderIcons, file.path));
        }
      })
    )
  );
};
