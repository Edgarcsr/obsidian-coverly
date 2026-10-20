import type { App, TFile } from "obsidian";

import {
  COVER_KEYS,
  FM,
  dataFromFrontmatter,
  migrateLegacyKeys,
} from "./note-data";

/** Notas que usam a imagem como capa ou ícone (elas perdem a imagem se for excluída). */
const notesUsing = (app: App, path: string): TFile[] =>
  app.vault.getMarkdownFiles().filter((file) => {
    const data = dataFromFrontmatter(
      app.metadataCache.getFileCache(file)?.frontmatter
    );
    return data.cover === path || data.icon === path;
  });

export const imageUsage = (app: App, path: string): number =>
  notesUsing(app, path).length;

/**
 * Tira a imagem das notas que a usam, antes de o arquivo ser apagado: sem isso
 * elas continuariam pedindo uma imagem que não existe mais, a cada desenho.
 */
export const releaseImage = async (app: App, path: string): Promise<void> => {
  await Promise.all(
    notesUsing(app, path).map((file) =>
      app.fileManager.processFrontMatter(
        file,
        (fm: Record<string, unknown>) => {
          migrateLegacyKeys(fm);
          if (fm[FM.icon] === path) {
            Reflect.deleteProperty(fm, FM.icon);
          }
          if (fm[FM.cover] === path) {
            for (const key of COVER_KEYS) {
              Reflect.deleteProperty(fm, key);
            }
          }
        }
      )
    )
  );
};
