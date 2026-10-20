import { normalizePath, setIcon, setTooltip } from "obsidian";
import type { App } from "obsidian";

import { asyncListener } from "./async-listener";
import { confirmDelete } from "./confirm-delete";
import { coverFolder } from "./cover-cache";
import { t } from "./i18n";
import { trimIconImage } from "./icon-trim";

/**
 * Imagens enviadas pelo Coverly, separadas por uso dentro da pasta do plugin
 * (`.coverly/banners`, `.coverly/icons`): um ícone enviado não aparece entre
 * as capas, e vice-versa.
 *
 * A pasta começa com ponto, então o Obsidian não a indexa: nada de
 * `getFileByPath` aqui. Os arquivos são lidos e escritos pelo adapter, e a
 * nota guarda o caminho (`.coverly/banners/foto.png`) como guardaria o de um
 * anexo comum.
 */

export type ImageKind = "banners" | "icons";

const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/iu;

/** Caminho → URL de recurso, calculada uma vez (ver `pluginImageUrl`). */
const urls = new Map<string, string>();

export const pluginImageFolder = (kind: ImageKind): string =>
  normalizePath(`${coverFolder()}/${kind}`);

/** O valor aponta para uma imagem guardada pelo Coverly (capa ou ícone). */
export const isPluginImagePath = (value: string): boolean =>
  value.startsWith(`${coverFolder()}/`) && IMAGE_EXTENSION.test(value);

/**
 * URL de recurso da imagem. Fora do índice do vault, `getResourcePath` põe um
 * carimbo de tempo novo a cada chamada; guardar a primeira evita recarregar a
 * imagem a cada desenho.
 */
export const pluginImageUrl = (app: App, path: string): string => {
  let url = urls.get(path);
  if (!url) {
    url = app.vault.adapter.getResourcePath(path);
    urls.set(path, url);
  }
  return url;
};

const splitName = (name: string): { base: string; ext: string } => {
  const dot = name.lastIndexOf(".");
  return dot > 0
    ? { base: name.slice(0, dot), ext: name.slice(dot + 1) }
    : { base: name, ext: "png" };
};

/** Grava a imagem na pasta do tipo dela e devolve o caminho. Nomes repetidos ganham " 2", " 3"… */
export const savePluginImage = async (
  app: App,
  file: File,
  kind: ImageKind
): Promise<string> => {
  const { adapter } = app.vault;
  const folder = pluginImageFolder(kind);
  if (!(await adapter.exists(folder))) {
    await adapter.mkdir(folder);
  }
  // Colar do clipboard vem como "image.png": vira um nome com data.
  const fallback = `${kind === "icons" ? "icon" : "cover"} ${window.moment().format("YYYY-MM-DD HHmmss")}`;
  const { base, ext } = splitName(file.name || `${fallback}.png`);
  const stem = base === "image" ? fallback : base;
  let path = normalizePath(`${folder}/${stem}.${ext}`);
  // Poucas voltas, uma por nome já usado; precisam ser em sequência.
  // oxlint-disable-next-line no-await-in-loop
  for (let copy = 2; await adapter.exists(path); copy += 1) {
    path = normalizePath(`${folder}/${stem} ${copy}.${ext}`);
  }
  await adapter.writeBinary(path, await file.arrayBuffer());
  return path;
};

export interface PluginImage {
  path: string;
  name: string;
  mtime: number;
}

/** Imagens guardadas de um tipo, as mais recentes primeiro. */
export const listPluginImages = async (
  app: App,
  kind: ImageKind
): Promise<PluginImage[]> => {
  const { adapter } = app.vault;
  const folder = pluginImageFolder(kind);
  if (!(await adapter.exists(folder))) {
    return [];
  }
  const { files } = await adapter.list(folder);
  const images = await Promise.all(
    files
      .filter((path) => IMAGE_EXTENSION.test(path))
      .map(async (path) => {
        const stat = await adapter.stat(path);
        return {
          mtime: stat?.mtime ?? 0,
          name: path.slice(path.lastIndexOf("/") + 1),
          path,
        };
      })
  );
  return images.toSorted((a, b) => b.mtime - a.mtime);
};

/** Apaga a imagem da pasta do Coverly. As notas que a citam não são alteradas. */
export const deletePluginImage = async (
  app: App,
  path: string
): Promise<void> => {
  await app.vault.adapter.remove(path);
  urls.delete(path);
};

/**
 * Lixeira no canto do ladrilho. Pede confirmação por cima do seletor antes de
 * excluir (dizendo em quantas notas a imagem é usada).
 */
const addDeleteButton = (
  item: HTMLElement,
  context: SavedImagesContext,
  image: PluginImage,
  onDeleted: () => void
): void => {
  const button = item.createEl("button", {
    attr: { "aria-label": t("saved.delete") },
    cls: "mdp-picker-delete",
  });
  setIcon(button, "trash-2");
  setTooltip(button, t("saved.delete"));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    confirmDelete(item.closest<HTMLElement>(".mdp-picker") ?? document.body, {
      name: image.name,
      onConfirm: async () => {
        await context.release(image.path);
        await deletePluginImage(context.app, image.path);
        onDeleted();
      },
      usage: context.usage(image.path),
    });
  });
};

export interface SavedImagesContext {
  app: App;
  kind: ImageKind;
  /** Valor atual da nota, para marcar a imagem selecionada. */
  current: string | undefined;
  pick: (path: string) => Promise<void>;
  /** Quantas notas usam a imagem, para avisar antes de excluir. */
  usage: (path: string) => number;
  /** Tira a imagem das notas que a usam; roda antes de o arquivo ser apagado. */
  release: (path: string) => Promise<void>;
}

/**
 * Seção "Salvas no Coverly": as imagens já enviadas deste tipo, em ladrilhos
 * iguais aos da galeria. Sem nenhuma, a seção não aparece.
 */
export const renderSavedImages = async (
  parent: HTMLElement,
  context: SavedImagesContext
): Promise<void> => {
  const { app } = context;
  const section = parent.createDiv({ cls: "mdp-picker-saved" });
  const images = await listPluginImages(app, context.kind);
  if (images.length === 0) {
    section.remove();
    return;
  }
  section.createDiv({
    cls: "mdp-picker-section-title",
    text: t("saved.title"),
  });
  const grid = section.createDiv({
    cls:
      context.kind === "icons"
        ? "mdp-picker-grid is-framed is-square"
        : "mdp-picker-grid is-framed",
  });
  for (const image of images) {
    const item = grid.createDiv({ cls: "mdp-picker-item" });
    const tile = item.createEl("button", {
      attr: { "aria-label": image.name },
      cls:
        image.path === context.current
          ? "mdp-picker-tile is-selected"
          : "mdp-picker-tile",
    });
    if (context.kind === "icons") {
      tile.addClass("is-icon");
    }
    const img = tile.createEl("img", {
      attr: {
        alt: image.name,
        loading: "lazy",
        src: pluginImageUrl(app, image.path),
      },
    });
    if (context.kind === "icons") {
      trimIconImage(img, {
        path: image.path,
        read: () => app.vault.adapter.readBinary(image.path),
      });
    }
    setTooltip(tile, image.name);
    tile.addEventListener(
      "click",
      asyncListener(async () => {
        await context.pick(image.path);
      })
    );
    addDeleteButton(item, context, image, () => {
      item.remove();
      if (!grid.hasChildNodes()) {
        section.remove();
      }
    });
  }
};
