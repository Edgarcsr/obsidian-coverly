import type { App } from "obsidian";

import { coverThumbPath } from "./cover-thumbs";

/**
 * Prévia minúscula e já borrada de cada capa, guardada na memória como
 * `data:` URL. Ela fica por baixo da foto na capa: uma `data:` URL é desenhada
 * na hora, sem ler o disco, então a moldura nunca aparece vazia enquanto a
 * foto carrega, mesmo depois de o navegador ter descartado a foto da memória.
 *
 * É feita da miniatura de 320px (ver cover-thumbs.ts) e pesa poucos KB.
 */

/** Largura da prévia, em px. Ampliada na capa, vira um borrão suave. */
const WIDTH = 96;
const BLUR_PX = 2;
/** Desenha um pouco além das bordas: o desfoque não escurece os cantos. */
const BLEED_PX = BLUR_PX * 2;
const QUALITY = 0.7;
/** Quantas prévias guardar (as mais antigas saem primeiro). */
const LIMIT = 200;

/** Caminho da miniatura → prévia. */
const ready = new Map<string, string>();
const pending = new Set<string>();

/** Prévia da capa, se já foi feita. Síncrona: serve para o primeiro desenho. */
export const coverPlaceholder = (value: string): string | null => {
  const path = coverThumbPath(value);
  return path ? (ready.get(path) ?? null) : null;
};

const decodeBytes = async (
  bytes: ArrayBuffer
): Promise<HTMLImageElement | null> => {
  const url = URL.createObjectURL(new Blob([bytes]));
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

const render = (image: HTMLImageElement): string | null => {
  if (!image.naturalWidth || !image.naturalHeight) {
    return null;
  }
  const width = WIDTH;
  const height = Math.max(
    1,
    Math.round((WIDTH * image.naturalHeight) / image.naturalWidth)
  );
  const canvas = createEl("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.filter = `blur(${BLUR_PX}px)`;
  context.drawImage(
    image,
    -BLEED_PX,
    -BLEED_PX,
    width + BLEED_PX * 2,
    height + BLEED_PX * 2
  );
  return canvas.toDataURL("image/webp", QUALITY);
};

/**
 * Prepara a prévia da capa em segundo plano, para os próximos desenhos. Sem
 * miniatura no disco ainda, não faz nada (ela é pedida em outro lugar).
 */
export const preparePlaceholder = async (
  app: App,
  value: string
): Promise<void> => {
  const path = coverThumbPath(value);
  if (!path || ready.has(path) || pending.has(path)) {
    return;
  }
  pending.add(path);
  try {
    const image = await decodeBytes(await app.vault.adapter.readBinary(path));
    const url = image ? render(image) : null;
    if (url) {
      ready.set(path, url);
      const oldest = ready.keys().next().value;
      if (ready.size > LIMIT && oldest !== undefined) {
        ready.delete(oldest);
      }
    }
  } catch {
    // Miniatura apagada (ex.: limpeza do cache): fica sem prévia.
  } finally {
    pending.delete(path);
  }
};

export const placeholderCount = (): number => ready.size;
