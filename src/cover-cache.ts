import { normalizePath, requestUrl } from "obsidian";
import type { App } from "obsidian";

/**
 * Cópia local das capas que vêm da internet (Unsplash, MET, links colados).
 *
 * A nota continua guardando a URL; o arquivo baixado fica numa pasta do vault
 * (por padrão `.coverly`, que o Obsidian não indexa nem mostra no explorador) com
 * um nome derivado da URL. Assim a capa abre do disco, sem esperar a rede, e a
 * nota continua funcionando em outro vault, onde a URL ainda vale.
 */

const EXTENSIONS: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

/** Pasta padrão do plugin no vault: capas baixadas e, em `thumbs/`, as miniaturas. */
export const DEFAULT_COVER_FOLDER = ".coverly";

/** Nome antigo da pasta, renomeado para o atual na primeira carga (ver main.ts). */
export const LEGACY_COVER_FOLDER = ".cover";

interface CacheState {
  app: App | null;
  enabled: boolean;
  folder: string;
  /** Hash da URL → nome do arquivo na pasta (a extensão vem do tipo baixado). */
  files: Map<string, string>;
  pending: Map<string, Promise<boolean>>;
}

const state: CacheState = {
  app: null,
  enabled: false,
  files: new Map(),
  folder: DEFAULT_COVER_FOLDER,
  pending: new Map(),
};

/** Dois módulos primos de ~31 bits: os produtos cabem com folga num Number. */
const MOD_A = 2_147_483_647;
const MOD_B = 2_147_483_629;

/**
 * Hash curto e estável da URL, para nomear o arquivo: dois hashes polinomiais
 * com módulos diferentes, juntos (~62 bits, colisão improvável na prática).
 */
export const hashUrl = (url: string): string => {
  let a = 7;
  let b = 11;
  for (const char of url) {
    const code = char.codePointAt(0) ?? 0;
    a = (a * 131 + code) % MOD_A;
    b = (b * 137 + code) % MOD_B;
  }
  return `${a.toString(36)}${b.toString(36).padStart(6, "0")}`;
};

const stem = (name: string): string => name.replace(/\.[^.]+$/u, "");

/** Caminho da cópia baixada → URL de recurso (ver `cachedCoverUrl`). */
const resourceUrls = new Map<string, string>();

/** Lê a pasta e monta o índice dos arquivos já baixados. */
const scan = async (): Promise<void> => {
  state.files.clear();
  resourceUrls.clear();
  const { app, folder } = state;
  if (!app || !(await app.vault.adapter.exists(folder))) {
    return;
  }
  const { files } = await app.vault.adapter.list(folder);
  for (const path of files) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    state.files.set(stem(name), name);
  }
};

export const configureCoverCache = async (options: {
  app: App;
  enabled: boolean;
  folder: string;
}): Promise<void> => {
  state.app = options.app;
  state.enabled = options.enabled;
  state.folder = normalizePath(options.folder.trim() || DEFAULT_COVER_FOLDER);
  await scan();
};

export const isCoverCacheEnabled = (): boolean => state.enabled;

/** Pasta atual das capas baixadas, já normalizada. */
export const coverFolder = (): string => state.folder;

/** Caminho no vault da cópia baixada, ou `null` se ela não existe (ou o recurso está desligado). */
export const cachedCoverPath = (url: string): string | null => {
  const name = state.enabled ? state.files.get(hashUrl(url)) : undefined;
  return name ? `${state.folder}/${name}` : null;
};

/** URL local da cópia baixada, ou `null` se ela não existe (ou o recurso está desligado). */
export const cachedCoverUrl = (url: string): string | null => {
  const path = cachedCoverPath(url);
  if (!(state.app && path)) {
    return null;
  }
  // Fora do índice do vault, cada chamada traria um carimbo de tempo novo (e
  // a imagem seria recarregada); a primeira URL fica guardada.
  let local = resourceUrls.get(path);
  if (!local) {
    local = state.app.vault.adapter.getResourcePath(path);
    resourceUrls.set(path, local);
  }
  return local;
};

const download = async (url: string, key: string): Promise<boolean> => {
  const { app, folder } = state;
  if (!app) {
    return false;
  }
  try {
    const res = await requestUrl({ throw: false, url });
    const type =
      (res.headers["content-type"] ?? "").split(";")[0]?.trim() ?? "";
    const ext = EXTENSIONS[type];
    if (res.status !== 200 || !ext) {
      return false;
    }
    const { adapter } = app.vault;
    if (!(await adapter.exists(folder))) {
      await adapter.mkdir(folder);
    }
    const name = `${key}.${ext}`;
    await adapter.writeBinary(`${folder}/${name}`, res.arrayBuffer);
    state.files.set(key, name);
    return true;
  } catch {
    // Sem rede ou URL inválida: a capa continua vindo da internet.
    return false;
  }
};

/**
 * Baixa a capa se ainda não há cópia. Devolve se a cópia existe ao final.
 * Chamadas repetidas para a mesma URL esperam o mesmo download.
 */
export const cacheCover = (url: string): Promise<boolean> => {
  if (!state.enabled || !state.app) {
    return Promise.resolve(false);
  }
  const key = hashUrl(url);
  if (state.files.has(key)) {
    return Promise.resolve(true);
  }
  let job = state.pending.get(key);
  if (!job) {
    job = (async () => {
      try {
        return await download(url, key);
      } finally {
        state.pending.delete(key);
      }
    })();
    state.pending.set(key, job);
  }
  return job;
};

/**
 * Baixa em segundo plano. A capa que já está na tela continua com a imagem da
 * internet; a cópia local vale a partir do próximo desenho.
 */
export const cacheCoverInBackground = (url: string): void => {
  if (state.enabled && !state.pending.has(hashUrl(url))) {
    void cacheCover(url);
  }
};
