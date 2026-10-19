import { normalizePath } from "obsidian";
import type { App } from "obsidian";

import { coverFolder } from "./cover-cache";
import { t } from "./i18n";
import { pluginImageFolder } from "./plugin-images";

/**
 * Quanto a pasta do Coverly (`.coverly`) ocupa, por parte, e a limpeza do que
 * pode ser refeito sozinho: capas baixadas (voltam do link da nota) e
 * miniaturas/versões leves (voltam da imagem). Banners e ícones enviados são
 * do usuário e nunca entram na limpeza.
 */

const SIZE_UNITS = ["B", "KB", "MB", "GB"] as const;
const KILO = 1024;
const ONE_DECIMAL_BELOW = 10;

/** "1,4 MB": tamanho curto, no formato de número do sistema. */
export const formatSize = (bytes: number): string => {
  let value = bytes;
  let unit = 0;
  while (value >= KILO && unit < SIZE_UNITS.length - 1) {
    value /= KILO;
    unit += 1;
  }
  const digits = unit === 0 || value >= ONE_DECIMAL_BELOW ? 0 : 1;
  const amount = value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
  return `${amount} ${SIZE_UNITS[unit]}`;
};

interface Usage {
  count: number;
  bytes: number;
}

export interface CoverlyUsage {
  downloads: Usage;
  thumbs: Usage;
  banners: Usage;
  icons: Usage;
}

const thumbsFolder = (): string => normalizePath(`${coverFolder()}/thumbs`);

/** Arquivos direto na pasta (sem entrar nas subpastas). */
const filesIn = async (app: App, folder: string): Promise<string[]> => {
  const { adapter } = app.vault;
  if (!(await adapter.exists(folder))) {
    return [];
  }
  const { files } = await adapter.list(folder);
  return files;
};

const usageOf = async (app: App, folder: string): Promise<Usage> => {
  const files = await filesIn(app, folder);
  const sizes = await Promise.all(
    files.map(async (path) => {
      const stat = await app.vault.adapter.stat(path);
      return stat?.size ?? 0;
    })
  );
  return {
    bytes: sizes.reduce((sum, size) => sum + size, 0),
    count: files.length,
  };
};

export const coverlyUsage = async (app: App): Promise<CoverlyUsage> => {
  const [downloads, thumbs, banners, icons] = await Promise.all([
    usageOf(app, coverFolder()),
    usageOf(app, thumbsFolder()),
    usageOf(app, pluginImageFolder("banners")),
    usageOf(app, pluginImageFolder("icons")),
  ]);
  return { banners, downloads, icons, thumbs };
};

/** Texto da configuração: o total e cada parte. */
export const describeUsage = (usage: CoverlyUsage): string => {
  const parts = [usage.downloads, usage.thumbs, usage.banners, usage.icons];
  const total = parts.reduce((sum, part) => sum + part.bytes, 0);
  return t("settings.storage.usage", {
    banners: formatSize(usage.banners.bytes),
    downloads: formatSize(usage.downloads.bytes),
    icons: formatSize(usage.icons.bytes),
    thumbs: formatSize(usage.thumbs.bytes),
    total: formatSize(total),
  });
};

/** Apaga as capas baixadas e as miniaturas; as notas continuam com os links. */
export const clearCoverCache = async (app: App): Promise<void> => {
  const files = [
    ...(await filesIn(app, coverFolder())),
    ...(await filesIn(app, thumbsFolder())),
  ];
  await Promise.all(files.map((path) => app.vault.adapter.remove(path)));
};
