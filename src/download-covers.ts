import { Notice } from "obsidian";
import type { App } from "obsidian";

import { cacheCover, isCoverCacheEnabled } from "./cover-cache";
import { t } from "./i18n";
import { dataFromFrontmatter, isRemoteCover } from "./note-data";

/** Quantas capas baixar ao mesmo tempo. */
const DOWNLOAD_WORKERS = 4;

/** Aviso ao usuário. Devolve a notificação para não ser um efeito colateral solto. */
const notify = (message: string): Notice => new Notice(message);

/** Baixa de uma vez as capas da internet de todas as notas do vault. */
export const downloadAllCovers = async (app: App): Promise<void> => {
  if (!isCoverCacheEnabled()) {
    notify(t("notice.coversDisabled"));
    return;
  }
  const urls = new Set<string>();
  for (const file of app.vault.getMarkdownFiles()) {
    const { cover } = dataFromFrontmatter(
      app.metadataCache.getFileCache(file)?.frontmatter
    );
    if (cover && isRemoteCover(cover)) {
      urls.add(cover);
    }
  }
  notify(t("notice.coversDownloading", { total: urls.size }));
  // Poucos downloads por vez, para não disparar centenas de requisições juntas.
  const queue = [...urls];
  let saved = 0;
  const worker = async (): Promise<void> => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      // oxlint-disable-next-line no-await-in-loop
      if (await cacheCover(url)) {
        saved += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: DOWNLOAD_WORKERS }, worker));
  notify(t("notice.coversDownloaded", { saved, total: urls.size }));
};
