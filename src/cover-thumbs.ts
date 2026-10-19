import { normalizePath, requestUrl } from "obsidian";
import type { App } from "obsidian";

import {
  cacheCover,
  cachedCoverPath,
  coverFolder,
  hashUrl,
  isCoverCacheEnabled,
} from "./cover-cache";
import { dataFromFrontmatter, isHexColor, isRemoteCover } from "./note-data";
import { isPluginImagePath } from "./plugin-images";

/**
 * Versões leves das capas com foto, guardadas em `<pasta das capas>/thumbs`:
 *
 * - **miniatura** (320px, poucos KB): aparece na hora, borrada, enquanto a
 *   capa carrega, e é o fundo dos itens do explorador (ver note-icons.ts);
 * - **exibição** (até 2560px): a capa que a nota mostra no lugar da foto
 *   original, que pode ter vários MB e demorar a decodificar. Só para capas
 *   que já estão no disco (imagens do vault e capas baixadas): para as da
 *   internet, guardá-la seria baixar a capa com a opção desligada.
 *
 * A chave de uma capa da internet é o hash da URL; a de um arquivo do vault
 * inclui a data de modificação, para as versões acompanharem a imagem.
 */

interface Variant {
  /** Vai no nome do arquivo: versões de outro tamanho não são reaproveitadas. */
  suffix: string;
  width: number;
  quality: number;
}

/** Larga o bastante para ampliar sem virar quadradinhos (64px ficava feio). */
const THUMB: Variant = { quality: 0.6, suffix: "_320", width: 320 };
/** Cobre uma capa de borda a borda numa tela grande com densidade 2×. */
const DISPLAY: Variant = { quality: 0.85, suffix: "_d2560", width: 2560 };
const VARIANTS = [THUMB, DISPLAY] as const;

/** Quantas capas processar ao mesmo tempo. */
const WORKERS = 2;

/** Formatos que não devem ser redesenhados: GIF perderia a animação, SVG a nitidez. */
const KEEP_ORIGINAL: Record<string, string> = {
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

interface Job {
  app: App;
  value: string;
  base: string;
  wanted: Set<Variant>;
}

interface ThumbState {
  app: App | null;
  folder: string;
  /** Chave (base + sufixo) → nome do arquivo na pasta. */
  files: Map<string, string>;
  /**
   * Chave → URL de recurso. Fora do índice do vault, `getResourcePath` põe um
   * carimbo de tempo novo a cada chamada; uma URL diferente a cada desenho
   * fazia o explorador recarregar (e piscar) as imagens a cada clique.
   */
  urls: Map<string, string>;
  /** Base → trabalho na fila (ainda não começou), para juntar pedidos. */
  queued: Map<string, Job>;
  /** Bases sendo processadas agora. */
  active: Set<string>;
  /** Chaves que falharam nesta sessão, para não tentar de novo a cada desenho. */
  failed: Set<string>;
  jobs: Job[];
  running: number;
  listener: (() => void) | null;
}

const state: ThumbState = {
  active: new Set(),
  app: null,
  failed: new Set(),
  files: new Map(),
  folder: "",
  jobs: [],
  listener: null,
  queued: new Map(),
  running: 0,
  urls: new Map(),
};

const stem = (name: string): string => name.replace(/\.[^.]+$/u, "");

const isCurrent = (key: string): boolean =>
  VARIANTS.some((variant) => key.endsWith(variant.suffix));

/** Lê a pasta e monta o índice das versões que já existem. */
export const configureCoverThumbs = async (app: App): Promise<void> => {
  state.app = app;
  state.folder = normalizePath(`${coverFolder()}/thumbs`);
  state.files.clear();
  state.urls.clear();
  state.failed.clear();
  if (!(await app.vault.adapter.exists(state.folder))) {
    return;
  }
  const { files } = await app.vault.adapter.list(state.folder);
  for (const path of files) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    if (isCurrent(stem(name))) {
      state.files.set(stem(name), name);
    } else {
      // Versão antiga (outro tamanho): some e é refeita quando precisar.
      // oxlint-disable-next-line no-await-in-loop
      await app.vault.adapter.remove(path);
    }
  }
};

/** Avisado sempre que uma versão nova fica pronta (o explorador redesenha). */
export const setThumbListener = (listener: (() => void) | null): void => {
  state.listener = listener;
};

/** Bytes da imagem original e o tipo, quando ele não se adivinha pelo conteúdo. */
interface Original {
  bytes: ArrayBuffer;
  type?: string;
}

const typeFromPath = (path: string): string | undefined => {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return Object.keys(KEEP_ORIGINAL).find((type) => KEEP_ORIGINAL[type] === ext);
};

const readOriginal = async (
  app: App,
  value: string
): Promise<Original | null> => {
  const { adapter } = app.vault;
  if (isPluginImagePath(value)) {
    return {
      bytes: await adapter.readBinary(value),
      type: typeFromPath(value),
    };
  }
  if (!isRemoteCover(value)) {
    const file = app.vault.getFileByPath(value);
    return file
      ? { bytes: await app.vault.readBinary(file), type: typeFromPath(value) }
      : null;
  }
  // Com a cópia local ligada, espera o download (que já pode estar em curso)
  // em vez de baixar a mesma foto duas vezes.
  if (isCoverCacheEnabled() && (await cacheCover(value))) {
    const path = cachedCoverPath(value);
    if (path) {
      return {
        bytes: await adapter.readBinary(path),
        type: typeFromPath(path),
      };
    }
  }
  const res = await requestUrl({ throw: false, url: value });
  if (res.status !== 200) {
    return null;
  }
  const type = (res.headers["content-type"] ?? "").split(";")[0]?.trim();
  return { bytes: res.arrayBuffer, type: type || undefined };
};

const decode = async (original: Original): Promise<HTMLImageElement | null> => {
  const url = URL.createObjectURL(
    new Blob(
      [original.bytes],
      original.type ? { type: original.type } : undefined
    )
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Redesenha a imagem na largura da versão (nunca maior que a original). */
const resize = async (
  image: HTMLImageElement,
  variant: Variant
): Promise<Blob | null> => {
  const { naturalHeight, naturalWidth } = image;
  // SVG sem tamanho declarado vem com 0 × 0: vira um quadrado.
  const width = naturalWidth
    ? Math.min(variant.width, naturalWidth)
    : variant.width;
  const height =
    naturalWidth && naturalHeight
      ? Math.max(1, Math.round((width * naturalHeight) / naturalWidth))
      : width;
  const canvas = createEl("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  // O canvas só entrega o blob por callback.
  // oxlint-disable-next-line promise/avoid-new
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", variant.quality);
  });
};

const write = async (
  app: App,
  key: string,
  ext: string,
  data: ArrayBuffer
): Promise<void> => {
  const { adapter } = app.vault;
  if (!(await adapter.exists(state.folder))) {
    await adapter.mkdir(state.folder);
  }
  const name = `${key}.${ext}`;
  await adapter.writeBinary(`${state.folder}/${name}`, data);
  state.files.set(key, name);
};

/** Decodifica a original uma vez e grava as versões pedidas. */
const run = async ({ app, base, value, wanted }: Job): Promise<void> => {
  const original = await readOriginal(app, value);
  const image = original ? await decode(original) : null;
  for (const variant of wanted) {
    const key = `${base}${variant.suffix}`;
    const keep = original?.type ? KEEP_ORIGINAL[original.type] : undefined;
    if (original && keep && variant === DISPLAY) {
      // oxlint-disable-next-line no-await-in-loop
      await write(app, key, keep, original.bytes);
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop
    const blob = image ? await resize(image, variant) : null;
    if (!blob) {
      state.failed.add(key);
      continue;
    }
    // Sem suporte a WebP (Safari antigo), o canvas entrega PNG.
    const ext = blob.type === "image/webp" ? "webp" : "png";
    // oxlint-disable-next-line no-await-in-loop
    await write(app, key, ext, await blob.arrayBuffer());
  }
  state.listener?.();
};

/** Tira trabalhos da fila até ela esvaziar, com poucos ao mesmo tempo. */
const pump = (): void => {
  while (state.running < WORKERS && state.jobs.length > 0) {
    const job = state.jobs.shift();
    if (!job) {
      return;
    }
    state.queued.delete(job.base);
    state.active.add(job.base);
    state.running += 1;
    void (async () => {
      try {
        await run(job);
      } catch {
        // Sem rede ou arquivo ilegível: a capa só não ganha as versões.
        for (const variant of job.wanted) {
          state.failed.add(`${job.base}${variant.suffix}`);
        }
      } finally {
        state.active.delete(job.base);
        state.running -= 1;
        pump();
      }
    })();
  }
};

const baseKey = (app: App, value: string): string | null => {
  // URLs e imagens enviadas pelo Coverly não mudam de conteúdo com o mesmo nome.
  if (isRemoteCover(value) || isPluginImagePath(value)) {
    return hashUrl(value);
  }
  const file = app.vault.getFileByPath(value);
  return file ? hashUrl(`${file.path}\n${file.stat.mtime}`) : null;
};

/**
 * URL da versão `variant` da capa `value` (URL ou caminho de imagem do vault).
 * Se ela ainda não existe, entra na fila e a função devolve `null`; o ouvinte
 * de `setThumbListener` é avisado quando ficar pronta.
 */
const variantUrl = (value: string, variant: Variant): string | null => {
  const { app } = state;
  const base = app ? baseKey(app, value) : null;
  if (!(app && base)) {
    return null;
  }
  const key = `${base}${variant.suffix}`;
  const name = state.files.get(key);
  if (name) {
    let url = state.urls.get(key);
    if (!url) {
      url = app.vault.adapter.getResourcePath(`${state.folder}/${name}`);
      state.urls.set(key, url);
    }
    return url;
  }
  if (state.failed.has(key) || state.active.has(base)) {
    return null;
  }
  // Pedidos da mesma capa antes do trabalho começar viram um só.
  const pending = state.queued.get(base);
  if (pending) {
    pending.wanted.add(variant);
    return null;
  }
  const job: Job = { app, base, value, wanted: new Set([variant]) };
  state.queued.set(base, job);
  state.jobs.push(job);
  pump();
  return null;
};

/** Miniatura borrada da capa (ver o topo do arquivo). */
export const coverThumbUrl = (value: string): string | null =>
  variantUrl(value, THUMB);

/**
 * Versão de exibição da capa, ou `null` enquanto ela não existe. Capas da
 * internet sem cópia local não ganham uma (seria baixá-las sem a opção ligada).
 */
export const coverDisplayUrl = (value: string): string | null =>
  isRemoteCover(value) && !cachedCoverPath(value)
    ? null
    : variantUrl(value, DISPLAY);

/**
 * Prepara em segundo plano as versões das capas que não precisam de rede nova:
 * imagens do vault e capas da internet que já foram baixadas. As demais são
 * geradas quando aparecem (na nota ou no explorador). Assim abrir uma nota
 * costuma encontrar tudo pronto.
 */
export const warmCoverThumbs = (app: App): void => {
  for (const file of app.vault.getMarkdownFiles()) {
    const { cover } = dataFromFrontmatter(
      app.metadataCache.getFileCache(file)?.frontmatter
    );
    if (!cover || cover.startsWith("gradient:") || isHexColor(cover)) {
      continue;
    }
    if (!isRemoteCover(cover) || cachedCoverPath(cover)) {
      coverThumbUrl(cover);
      coverDisplayUrl(cover);
    }
  }
};
