import { normalizePath } from "obsidian";
import type { App } from "obsidian";

import { coverFolder } from "./cover-cache";
import { ICON_PACKS, downloadPack, packInfo } from "./icon-pack-catalog";
import type { PackIconSource } from "./icon-pack-catalog";
import { normalize } from "./lucide-search";
import { measureAsync } from "./perf";

/**
 * Pacotes de ícones instalados. Cada um fica num arquivo só, em
 * `<pasta do Coverly>/icon-packs/<id>/icons.json`, e só é lido quando algo
 * precisa dele: uma nota ou pasta com um ícone do pacote, ou o seletor.
 *
 * O ícone fica gravado como "pack:<pacote>:<nome>", com a cor opcional no fim
 * nos pacotes de uma cor só ("pack:tabler:home:blue"). Sem o pacote instalado
 * neste aparelho, o ícone não aparece, mas continua gravado.
 */
const PACK_PREFIX = "pack:";
const LEGACY_SYMBOLS_PREFIX = "symbols:";
const PACK_FILE = "icons.json";
const WORD_SEPARATORS = /[\s-]+/u;

interface StoredPack {
  version: string;
  icons: PackIconSource[];
}

interface LoadedPack {
  names: string[];
  svgs: Map<string, string>;
  urls: Map<string, string>;
}

export interface PackIcon {
  pack: string;
  name: string;
  /** Cor da paleta ou hexadecimal; `null` nos coloridos ou na cor padrão. */
  color: string | null;
}

let app: App | null = null;
let onPackLoad: (() => void) | null = null;
/** Sobe a cada pacote carregado, instalado ou removido; entra na chave de quem desenha. */
let version = 0;
const loaded = new Map<string, LoadedPack>();
/** Leituras em andamento ou já feitas; `null` é pacote não instalado. */
const loading = new Map<string, Promise<LoadedPack | null>>();

/** Liga o módulo ao vault. `onLoad` roda quando um pacote termina de carregar. */
export const configureIconPacks = (vaultApp: App, onLoad: () => void): void => {
  app = vaultApp;
  onPackLoad = onLoad;
};

const notify = (): void => {
  version += 1;
  onPackLoad?.();
};

/** Muda quando os pacotes mudam: um ícone que não tinha como aparecer pode ter agora. */
export const iconPacksVersion = (): number => version;

const packFolder = (id: string): string =>
  normalizePath(`${coverFolder()}/icon-packs/${id}`);

const packPath = (id: string): string => `${packFolder(id)}/${PACK_FILE}`;

export const packIconValue = (
  pack: string,
  name: string,
  color: string | null
): string =>
  color === null
    ? `${PACK_PREFIX}${pack}:${name}`
    : `${PACK_PREFIX}${pack}:${name}:${color}`;

/** Ícone de pacote gravado, ou `null` se o valor for outra coisa. */
export const parsePackIcon = (value: string): PackIcon | null => {
  // A primeira versão da aba Pastas trazia o Symbols embutido e gravava
  // "symbols:folder-blue"; os nomes são os mesmos do pacote.
  if (value.startsWith(LEGACY_SYMBOLS_PREFIX)) {
    const name = value.slice(LEGACY_SYMBOLS_PREFIX.length);
    return { color: null, name, pack: "symbols" };
  }
  if (!value.startsWith(PACK_PREFIX)) {
    return null;
  }
  const [pack = "", name = "", color] = value
    .slice(PACK_PREFIX.length)
    .split(":");
  return { color: color ?? null, name, pack };
};

const readPack = async (id: string): Promise<LoadedPack | null> => {
  if (!app) {
    return null;
  }
  const { adapter } = app.vault;
  const path = packPath(id);
  if (!(await adapter.exists(path))) {
    return null;
  }
  const stored = JSON.parse(await adapter.read(path)) as StoredPack;
  const pack: LoadedPack = {
    names: stored.icons.map(([name]) => name),
    svgs: new Map(stored.icons),
    urls: new Map(),
  };
  loaded.set(id, pack);
  return pack;
};

/** Um arquivo estragado conta como pacote não instalado. */
const readPackSafely = async (id: string): Promise<LoadedPack | null> => {
  try {
    return await measureAsync("iconPacks.load", () => readPack(id));
  } catch (error) {
    console.error(error);
    return null;
  }
};

/** Lê o pacote do disco uma vez; as próximas chamadas reaproveitam a leitura. */
export const loadPack = (id: string): Promise<LoadedPack | null> => {
  let promise = loading.get(id);
  if (!promise) {
    promise = readPackSafely(id);
    loading.set(id, promise);
  }
  return promise;
};

/** Carrega o pacote em segundo plano e avisa quem desenha quando ele chega. */
const loadAndNotify = async (id: string): Promise<void> => {
  if (await loadPack(id)) {
    notify();
  }
};

/** Esquece o que foi lido do pacote, para a próxima leitura vir do disco. */
const forgetPack = (id: string): void => {
  loaded.delete(id);
  loading.delete(id);
};

/**
 * Data URL do ícone gravado em `value`, ou `null` se o pacote ainda não
 * carregou, não está instalado ou não tem o ícone. Se ainda não carregou,
 * começa a leitura e avisa quando terminar, para quem desenha tentar de novo.
 */
export const packIconUrl = (value: string): string | null => {
  const icon = parsePackIcon(value);
  if (!icon) {
    return null;
  }
  const pack = loaded.get(icon.pack);
  if (!pack) {
    if (!loading.has(icon.pack) && packInfo(icon.pack)) {
      void loadAndNotify(icon.pack);
    }
    return null;
  }
  let url = pack.urls.get(icon.name);
  if (url === undefined) {
    const svg = pack.svgs.get(icon.name);
    if (svg === undefined) {
      return null;
    }
    url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    pack.urls.set(icon.name, url);
  }
  return url;
};

/** O pacote do ícone desenha numa cor só e aceita a cor escolhida. */
export const isTintablePack = (id: string): boolean =>
  packInfo(id)?.tintable ?? false;

/** Nomes do pacote já carregado, na ordem dele. */
export const packNames = (id: string): readonly string[] =>
  loaded.get(id)?.names ?? [];

/**
 * Nomes que batem com a busca, os mais parecidos primeiro: o nome exato,
 * os que começam com a busca, os que a contêm e os que têm todas as palavras.
 */
export const searchPack = (
  names: readonly string[],
  query: string
): readonly string[] => {
  const words = normalize(query).split(WORD_SEPARATORS).filter(Boolean);
  if (words.length === 0) {
    return names;
  }
  const joined = words.join("-");
  const ranked: string[][] = [[], [], [], []];
  for (const name of names) {
    if (name === joined) {
      ranked[0]?.push(name);
    } else if (name.startsWith(joined)) {
      ranked[1]?.push(name);
    } else if (name.includes(joined)) {
      ranked[2]?.push(name);
    } else if (words.every((word) => name.includes(word))) {
      ranked[3]?.push(name);
    }
  }
  return ranked.flat();
};

/** Ids dos pacotes do catálogo instalados neste vault. */
export const installedPacks = async (vaultApp: App): Promise<string[]> => {
  const { adapter } = vaultApp.vault;
  const found = await Promise.all(
    ICON_PACKS.map(async (pack) => await adapter.exists(packPath(pack.id)))
  );
  return ICON_PACKS.filter((_, index) => found[index]).map((pack) => pack.id);
};

/** Tamanho do pacote instalado, em bytes. */
export const packSize = async (vaultApp: App, id: string): Promise<number> => {
  const stat = await vaultApp.vault.adapter.stat(packPath(id));
  return stat?.size ?? 0;
};

/**
 * Tamanho dos pacotes instalados, por id, guardado para as configurações
 * mostrarem o estado sem ler o disco a cada desenho. Sem o id, não está
 * instalado.
 */
const installedSizes = new Map<string, number>();

export const installedSize = (id: string): number | undefined =>
  installedSizes.get(id);

/** Já leu do disco quais pacotes estão instalados; antes disso, não se sabe. */
let installedKnown = false;

/** Lê do disco quais pacotes estão instalados e o tamanho de cada um. */
export const refreshInstalled = async (vaultApp: App): Promise<void> => {
  const ids = await installedPacks(vaultApp);
  const sizes = await Promise.all(ids.map((id) => packSize(vaultApp, id)));
  installedSizes.clear();
  for (const [index, id] of ids.entries()) {
    installedSizes.set(id, sizes[index] ?? 0);
  }
  installedKnown = true;
};

/**
 * O ícone é de um pacote que está (ou deve estar) instalado e ainda não foi
 * lido do disco. Quem desenha reserva o espaço dele nesse meio-tempo, para o
 * texto não andar quando o ícone chegar. Pacote ausente, ou sem esse ícone,
 * não conta: não vai aparecer nada.
 */
export const isPackIconPending = (value: string): boolean => {
  const icon = parsePackIcon(value);
  if (!icon || loaded.has(icon.pack) || !packInfo(icon.pack)) {
    return false;
  }
  return !installedKnown || installedSizes.has(icon.pack);
};

/**
 * Lê os pacotes instalados no início do plugin, antes da primeira pintura:
 * assim os ícones deles já saem desenhados, em vez de surgirem um instante
 * depois. São poucos milissegundos por pacote.
 */
export const preloadIconPacks = async (vaultApp: App): Promise<void> => {
  await refreshInstalled(vaultApp);
  await Promise.all(
    [...installedSizes.keys()].map(async (id) => await loadPack(id))
  );
};

/** Baixa o pacote e o grava no vault. */
export const installPack = async (
  vaultApp: App,
  id: string,
  onProgress: (done: number, total: number) => void
): Promise<void> => {
  const info = packInfo(id);
  if (!info) {
    throw new Error(`Unknown icon pack: ${id}`);
  }
  const icons = await downloadPack(info, onProgress);
  const { adapter } = vaultApp.vault;
  const folder = packFolder(id);
  if (!(await adapter.exists(folder))) {
    await adapter.mkdir(folder);
  }
  const stored: StoredPack = { icons, version: info.source.version };
  await adapter.write(packPath(id), JSON.stringify(stored));
  forgetPack(id);
  await refreshInstalled(vaultApp);
  notify();
};

/** Apaga o pacote do vault. Os ícones gravados ficam, mas somem da tela. */
export const removePack = async (vaultApp: App, id: string): Promise<void> => {
  const { adapter } = vaultApp.vault;
  const folder = packFolder(id);
  if (await adapter.exists(folder)) {
    await adapter.rmdir(folder, true);
  }
  forgetPack(id);
  await refreshInstalled(vaultApp);
  notify();
};
