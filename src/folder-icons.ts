import { TFolder, normalizePath } from "obsidian";
import type { App, TAbstractFile } from "obsidian";

import { asyncListener } from "./async-listener";
import { coverFolder } from "./cover-cache";
import type CoverlyPlugin from "./main";

/**
 * Ícones das pastas. Pasta não tem frontmatter, então o ícone fica num
 * arquivo na pasta do Coverly no vault (`.coverly/folder-icons.json`), pelo
 * caminho da pasta, no mesmo formato do ícone da nota. Fora da pasta do
 * plugin, ele sobrevive a desinstalar e reinstalar, como as imagens enviadas.
 * Renomear, mover ou apagar a pasta leva junto as entradas dela e das
 * subpastas.
 */
export type FolderIcons = Record<string, string>;

const FOLDER_ICONS_FILE = "folder-icons.json";

const folderIconsPath = (): string =>
  normalizePath(`${coverFolder()}/${FOLDER_ICONS_FILE}`);

/** Só as entradas com texto: um arquivo editado à mão não quebra os ícones. */
const parseFolderIcons = (text: string): FolderIcons => {
  const icons: FolderIcons = {};
  const data: unknown = JSON.parse(text);
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return icons;
  }
  for (const [path, value] of Object.entries(data)) {
    if (typeof value === "string") {
      icons[path] = value;
    }
  }
  return icons;
};

/** Lê os ícones gravados. Sem arquivo (ou ilegível), nenhum. */
export const readFolderIcons = async (app: App): Promise<FolderIcons> => {
  const { adapter } = app.vault;
  const path = folderIconsPath();
  try {
    if (!(await adapter.exists(path))) {
      return {};
    }
    return parseFolderIcons(await adapter.read(path));
  } catch {
    return {};
  }
};

/** Gravações em fila: uma mais antiga nunca sobrescreve uma mais nova. */
let pendingWrite: Promise<void> = Promise.resolve();

export const writeFolderIcons = async (
  app: App,
  icons: FolderIcons
): Promise<void> => {
  const text = JSON.stringify(icons, null, "\t");
  const previous = pendingWrite;
  const write = async (): Promise<void> => {
    try {
      await previous;
    } catch {
      // A anterior falhou: esta grava mesmo assim, com os ícones de agora.
    }
    const { adapter } = app.vault;
    const folder = coverFolder();
    if (!(await adapter.exists(folder))) {
      await adapter.mkdir(folder);
    }
    await adapter.write(folderIconsPath(), text);
  };
  pendingWrite = write();
  await pendingWrite;
};

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
      await plugin.saveFolderIcons();
      plugin.refreshHeaders();
    }
  };
  plugin.registerEvent(
    vault.on(
      "rename",
      asyncListener(async (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFolder) {
          const { folderIcons } = plugin;
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
          await save(removeFolderIcons(plugin.folderIcons, file.path));
        }
      })
    )
  );
};
