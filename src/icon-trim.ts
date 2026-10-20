/**
 * Corta as margens transparentes das imagens usadas como
 * ícone, para o desenho preencher o quadrado. Não mexe no arquivo: a versão
 * cortada é só uma imagem em memória, feita uma vez por endereço.
 */

import { count } from "./perf";

/** Maior lado, em pixels, da imagem lida para achar o desenho. */
const SCAN_SIZE = 1024;
/** Maior lado, em pixels, da imagem cortada. */
const OUTPUT_SIZE = 512;
/** Só pixels totalmente transparentes contam como vazio. */
const MIN_ALPHA = 1;
/** Se o desenho já ocupa tanto do quadrado, não há o que cortar. */
const SKIP_COVERAGE = 0.995;
const RGBA = 4;

let enabled = false;
/** Endereço original → imagem cortada (ou `null` quando não há o que cortar). */
const trimmed = new Map<string, Promise<string | null>>();
const ready = new Map<string, string | null>();

export const setIconTrim = (value: boolean): void => {
  enabled = value;
};

/** Arquivo local do ícone: caminho (para o tipo e o cache) e como ler os bytes. */
export interface IconFile {
  path: string;
  read: () => Promise<ArrayBuffer>;
}

const decodeFrom = async (src: string, anonymous: boolean) => {
  const image = new Image();
  if (anonymous) {
    image.crossOrigin = "anonymous";
  }
  image.src = src;
  try {
    await image.decode();
  } catch {
    return null;
  }
  return image;
};

/**
 * Carrega a imagem de um jeito que deixa ler os pixels. Arquivos do vault
 * vêm por `app://` de outra origem, e o canvas que os desenha fica bloqueado
 * para leitura: por isso eles são lidos em bytes e abertos como `blob:`.
 */
const loadImage = async (
  src: string,
  file: IconFile | null
): Promise<HTMLImageElement | null> => {
  if (!file) {
    return await decodeFrom(src, /^https?:/u.test(src));
  }
  let bytes: ArrayBuffer;
  try {
    bytes = await file.read();
  } catch {
    return null;
  }
  const type = file.path.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "";
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  try {
    return await decodeFrom(url, false);
  } finally {
    URL.revokeObjectURL(url);
  }
};

interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const isContent = (data: Uint8ClampedArray, at: number): boolean =>
  (data[at + 3] ?? 0) >= MIN_ALPHA;

/** Menor retângulo (em fração 0–1 da imagem) que contém o desenho. */
const contentBox = (image: HTMLImageElement): Box | null => {
  const scale = Math.min(1, SCAN_SIZE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createEl("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  context.drawImage(image, 0, 0, width, height);
  let data: Uint8ClampedArray;
  try {
    ({ data } = context.getImageData(0, 0, width, height));
  } catch {
    // Imagem de outro site sem permissão: o canvas não pode ser lido.
    return null;
  }
  const box = { bottom: -1, left: width, right: -1, top: height };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isContent(data, (y * width + x) * RGBA)) {
        box.left = Math.min(box.left, x);
        box.right = Math.max(box.right, x);
        box.top = Math.min(box.top, y);
        box.bottom = Math.max(box.bottom, y);
      }
    }
  }
  if (box.right < 0) {
    return null;
  }
  return {
    bottom: (box.bottom + 1) / height,
    left: box.left / width,
    right: (box.right + 1) / width,
    top: box.top / height,
  };
};

const crop = async (
  src: string,
  file: IconFile | null
): Promise<string | null> => {
  const image = await loadImage(src, file);
  if (!image) {
    count("iconTrim.loadFailed");
    return null;
  }
  const box = contentBox(image);
  if (!box) {
    count("iconTrim.unreadable");
    return null;
  }
  const boxWidth = (box.right - box.left) * image.width;
  const boxHeight = (box.bottom - box.top) * image.height;
  const side = Math.max(boxWidth, boxHeight);
  if (side / Math.max(image.width, image.height) > SKIP_COVERAGE) {
    count("iconTrim.nothingToTrim");
    return null;
  }
  const size = Math.min(OUTPUT_SIZE, Math.round(side));
  const edge = side;
  const ratio = size / edge;
  const canvas = createEl("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  // Centraliza o desenho no quadrado, mesmo que ele passe das bordas da imagem.
  const centerX = ((box.left + box.right) / 2) * image.width;
  const centerY = ((box.top + box.bottom) / 2) * image.height;
  context.drawImage(
    image,
    (size - edge * ratio) / 2 + (edge / 2 - centerX) * ratio,
    (size - edge * ratio) / 2 + (edge / 2 - centerY) * ratio,
    image.width * ratio,
    image.height * ratio
  );
  count("iconTrim.trimmed");
  return canvas.toDataURL("image/png");
};

export const isIconTrimEnabled = (): boolean => enabled;

/**
 * Chama `apply` com a versão cortada da imagem `src` quando a opção está
 * ligada e há o que cortar: na hora, se já foi feita; senão, quando ficar pronta.
 */
export const whenTrimmed = (
  src: string,
  file: IconFile | null,
  apply: (url: string) => void
): void => {
  if (!enabled) {
    return;
  }
  const key = file?.path ?? src;
  if (ready.has(key)) {
    const cached = ready.get(key);
    if (cached) {
      apply(cached);
    }
    return;
  }
  let pending = trimmed.get(key);
  if (!pending) {
    pending = crop(src, file);
    trimmed.set(key, pending);
  }
  void (async () => {
    const url = await pending;
    ready.set(key, url);
    if (url) {
      apply(url);
    }
  })();
};

/**
 * Faz `img` mostrar a versão cortada do ícone quando a opção está ligada. Até
 * ela ficar pronta (ou se não houver o que cortar), a imagem original fica.
 */
export const trimIconImage = (
  img: HTMLImageElement,
  file: IconFile | null
): void => {
  const original = img.getAttribute("src");
  if (!original) {
    return;
  }
  whenTrimmed(original, file, (url) => {
    img.src = url;
  });
};
