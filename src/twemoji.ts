import { requestUrl } from "obsidian";
import type { DataAdapter } from "obsidian";

import { twemojiCode } from "./twemoji-code";

/**
 * Emojis desenhados no estilo do X (Twemoji). As imagens vêm do jsDelivr sob
 * demanda; sem rede, cai no emoji do sistema.
 *
 * Cada SVG baixado vai para um cache em memória (como data URL, que o
 * navegador desenha sem esperar a rede) e para um arquivo na pasta do plugin,
 * lido de novo ao abrir o Obsidian. Assim cada emoji só é baixado uma vez.
 */
const TWEMOJI_BASE = "https://cdn.jsdelivr.net/npm/@twemoji/svg@15.0.0/";

/** Espera depois do último emoji novo antes de gravar o arquivo do cache. */
const SAVE_DELAY = 2000;

/** SVGs já baixados, pelo código do emoji. */
const svgs = new Map<string, string>();
/** Data URLs prontas, montadas sob demanda a partir de `svgs`. */
const dataUrls = new Map<string, string>();
/** Downloads em andamento, para não pedir o mesmo emoji duas vezes. */
const pending = new Set<string>();

let store: { adapter: DataAdapter; path: string } | null = null;
let saveTimer: number | null = null;

const dataUrlFor = (code: string): string | undefined => {
  const ready = dataUrls.get(code);
  if (ready !== undefined) {
    return ready;
  }
  const svg = svgs.get(code);
  if (svg === undefined) {
    return undefined;
  }
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  dataUrls.set(code, url);
  return url;
};

const save = async (): Promise<void> => {
  if (!store) {
    return;
  }
  try {
    await store.adapter.write(
      store.path,
      JSON.stringify(Object.fromEntries(svgs))
    );
  } catch {
    // Sem gravar, o cache vale só até fechar o Obsidian.
  }
};

const scheduleSave = (): void => {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void save();
  }, SAVE_DELAY);
};

/** Baixa o SVG do emoji e o guarda. Se falhar, continua valendo o link do CDN. */
const remember = async (code: string): Promise<void> => {
  if (!store || svgs.has(code) || pending.has(code)) {
    return;
  }
  pending.add(code);
  try {
    const { text } = await requestUrl(`${TWEMOJI_BASE}${code}.svg`);
    svgs.set(code, text);
    scheduleSave();
  } catch {
    // Sem rede: tenta de novo na próxima vez que o emoji aparecer.
  } finally {
    pending.delete(code);
  }
};

/** Lê o cache gravado em `path` (relativo ao vault) e passa a gravar nele. */
export const loadTwemojiCache = async (
  adapter: DataAdapter,
  path: string
): Promise<void> => {
  store = { adapter, path };
  try {
    if (!(await adapter.exists(path))) {
      return;
    }
    const saved = JSON.parse(await adapter.read(path)) as Record<
      string,
      unknown
    >;
    for (const [code, svg] of Object.entries(saved)) {
      if (typeof svg === "string" && !svgs.has(code)) {
        svgs.set(code, svg);
      }
    }
  } catch {
    // Arquivo corrompido: começa do zero e ele é regravado no próximo emoji.
  }
};

/** Grava o que estiver pendente e solta o cache ao descarregar o plugin. */
export const closeTwemojiCache = async (): Promise<void> => {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
    await save();
  }
  store = null;
  svgs.clear();
  dataUrls.clear();
};

/** Endereço da imagem: a cópia guardada, se houver; senão, o CDN. */
export const twemojiUrl = (emoji: string): string => {
  const code = twemojiCode(emoji);
  return dataUrlFor(code) ?? `${TWEMOJI_BASE}${code}.svg`;
};

/** Depois que a imagem do CDN carrega, guarda uma cópia para as próximas vezes. */
export const cacheTwemoji = (emoji: string): void => {
  void remember(twemojiCode(emoji));
};

/**
 * Desenha o emoji dentro de `el`: a imagem do Twemoji, ou o próprio texto se
 * o estilo nativo estiver ativo ou a imagem não carregar.
 */
export const drawEmoji = (
  el: HTMLElement,
  emoji: string,
  twemoji: boolean,
  // Na grade do seletor são centenas de imagens: só baixa as que aparecem.
  lazy = false
): void => {
  el.empty();
  if (!twemoji) {
    el.setText(emoji);
    return;
  }
  const img = el.createEl("img", {
    attr: {
      alt: emoji,
      // Decodifica fora da thread principal: a rolagem não espera as imagens.
      decoding: "async",
      draggable: "false",
      loading: lazy ? "lazy" : "eager",
      src: twemojiUrl(emoji),
    },
    cls: "mdp-twemoji",
  });
  img.addEventListener(
    "load",
    () => {
      cacheTwemoji(emoji);
    },
    { once: true }
  );
  img.addEventListener(
    "error",
    () => {
      el.empty();
      el.setText(emoji);
    },
    { once: true }
  );
};
