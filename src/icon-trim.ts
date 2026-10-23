/**
 * Corta as margens transparentes das imagens usadas como
 * ícone, para o desenho preencher o quadrado. Não mexe no arquivo: a versão
 * cortada é só uma imagem em memória, feita uma vez por endereço.
 *
 * O corte é leve de propósito: artes grandes (uma de 4K, por exemplo) já
 * travaram a tela ao abrir uma pasta. O que pesava era decodificar e redimensionar
 * a arte na thread principal, duas vezes (ao ler os pixels e ao desenhar o
 * recorte). Agora a decodificação, a redução e o recorte são feitos por
 * `createImageBitmap`, fora da thread principal, o PNG é codificado de forma
 * assíncrona e os cortes rodam um por vez, com uma pausa entre eles. Nenhum
 * passo ocupa a tela por mais que alguns milissegundos.
 */

import { count } from "./perf";

/** Maior lado, em pixels, da imagem lida para achar o desenho. */
const SCAN_SIZE = 512;
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

/** Devolve o controle ao navegador, para ele desenhar e tratar cliques entre dois passos. */
const yieldToBrowser = async (): Promise<void> => {
  // O navegador só avisa o fim do tempo por callback.
  // oxlint-disable-next-line promise/avoid-new
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
};

let queue: Promise<unknown> = Promise.resolve();

/** Um corte por vez: várias imagens ao mesmo tempo ocupavam a tela por centenas de milissegundos. */
const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
  const previous = queue;
  const run = (async (): Promise<T> => {
    try {
      await previous;
    } catch {
      // Um corte que falhou não trava os seguintes.
    }
    await yieldToBrowser();
    return await job();
  })();
  queue = run;
  return run;
};

/** O PNG é codificado fora da thread principal (`toDataURL` faria isso na hora). */
const encode = async (canvas: HTMLCanvasElement): Promise<string | null> => {
  // O canvas só entrega o blob por callback.
  // oxlint-disable-next-line promise/avoid-new
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  return blob ? URL.createObjectURL(blob) : null;
};

/** Arquivo local do ícone: caminho (para o tipo e o cache) e como ler os bytes. */
export interface IconFile {
  path: string;
  read: () => Promise<ArrayBuffer>;
}

const decodeFrom = async (
  src: string,
  anonymous: boolean
): Promise<HTMLImageElement | null> => {
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
 * A imagem aberta. Um `ImageBitmap` é decodificado fora da thread principal;
 * já o `<img>` só decodifica de verdade na primeira vez que é desenhado, e aí
 * uma arte de 4K trava a tela por dezenas de milissegundos.
 */
interface Loaded {
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  release: () => void;
}

const fromElement = (image: HTMLImageElement): Loaded => ({
  height: image.height,
  release: () => {
    // Um <img> não precisa ser solto.
  },
  source: image,
  width: image.width,
});

/** Abre o arquivo como bitmap (fora da thread principal); `null` se o formato não abrir assim. */
const openBitmap = async (blob: Blob): Promise<Loaded | null> => {
  try {
    const bitmap = await createImageBitmap(blob);
    return {
      height: bitmap.height,
      release: () => {
        bitmap.close();
      },
      source: bitmap,
      width: bitmap.width,
    };
  } catch {
    return null;
  }
};

/**
 * Carrega a imagem de um jeito que deixa ler os pixels. Arquivos do vault
 * vêm por `app://` de outra origem, e o canvas que os desenha fica bloqueado
 * para leitura: por isso eles são lidos em bytes. Imagens de pixels viram
 * bitmap; o SVG e as de links da internet abrem como `<img>`.
 */
const loadImage = async (
  src: string,
  file: IconFile | null
): Promise<Loaded | null> => {
  if (!file) {
    const image = await decodeFrom(src, /^https?:/u.test(src));
    return image ? fromElement(image) : null;
  }
  let bytes: ArrayBuffer;
  try {
    bytes = await file.read();
  } catch {
    return null;
  }
  const isSvg = file.path.toLowerCase().endsWith(".svg");
  const blob = new Blob([bytes], { type: isSvg ? "image/svg+xml" : "" });
  if (!isSvg) {
    const bitmap = await openBitmap(blob);
    if (bitmap) {
      return bitmap;
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = await decodeFrom(url, false);
    return image ? fromElement(image) : null;
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
const contentBox = async (loaded: Loaded): Promise<Box | null> => {
  const scale = Math.min(1, SCAN_SIZE / Math.max(loaded.width, loaded.height));
  const width = Math.max(1, Math.round(loaded.width * scale));
  const height = Math.max(1, Math.round(loaded.height * scale));
  let data: Uint8ClampedArray;
  try {
    // Reduzida fora da thread principal: desenhar a arte inteira aqui, com o
    // `getImageData` logo em seguida, decodificava tudo de uma vez na tela.
    const small = await createImageBitmap(loaded.source, {
      resizeHeight: height,
      resizeQuality: "medium",
      resizeWidth: width,
    });
    const canvas = createEl("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      small.close();
      return null;
    }
    context.drawImage(small, 0, 0);
    small.close();
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

/**
 * Desenha o quadrado em volta do desenho, em `size` pixels. Só a parte que está
 * dentro da imagem é recortada e reduzida (fora da thread principal); o que
 * passa das bordas fica transparente.
 */
const drawSquare = async (
  loaded: Loaded,
  box: Box,
  side: number
): Promise<HTMLCanvasElement | null> => {
  const size = Math.min(OUTPUT_SIZE, Math.round(side));
  const ratio = size / side;
  const left = ((box.left + box.right) / 2) * loaded.width - side / 2;
  const top = ((box.top + box.bottom) / 2) * loaded.height - side / 2;
  const x1 = Math.max(0, Math.floor(left));
  const y1 = Math.max(0, Math.floor(top));
  const x2 = Math.min(loaded.width, Math.ceil(left + side));
  const y2 = Math.min(loaded.height, Math.ceil(top + side));
  const piece = await createImageBitmap(
    loaded.source,
    x1,
    y1,
    Math.max(1, x2 - x1),
    Math.max(1, y2 - y1),
    {
      resizeHeight: Math.max(1, Math.round((y2 - y1) * ratio)),
      resizeQuality: "high",
      resizeWidth: Math.max(1, Math.round((x2 - x1) * ratio)),
    }
  );
  const canvas = createEl("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    piece.close();
    return null;
  }
  context.drawImage(piece, (x1 - left) * ratio, (y1 - top) * ratio);
  piece.close();
  return canvas;
};

const crop = async (
  src: string,
  file: IconFile | null
): Promise<string | null> => {
  const loaded = await loadImage(src, file);
  if (!loaded) {
    count("iconTrim.loadFailed");
    return null;
  }
  try {
    const box = await contentBox(loaded);
    if (!box) {
      count("iconTrim.unreadable");
      return null;
    }
    const side = Math.max(
      (box.right - box.left) * loaded.width,
      (box.bottom - box.top) * loaded.height
    );
    if (side / Math.max(loaded.width, loaded.height) > SKIP_COVERAGE) {
      count("iconTrim.nothingToTrim");
      return null;
    }
    const canvas = await drawSquare(loaded, box, side);
    if (!canvas) {
      return null;
    }
    count("iconTrim.trimmed");
    return await encode(canvas);
  } catch {
    count("iconTrim.unreadable");
    return null;
  } finally {
    loaded.release();
  }
};

export const isIconTrimEnabled = (): boolean => enabled;

/**
 * Chama `apply` com a versão cortada da imagem `src` quando a opção está
 * ligada e há o que cortar: na hora, se já foi feita; senão, quando ficar
 * pronta. Devolve `true` quando ainda falta fazer o corte; aí `settled` roda
 * no fim, com ou sem o que cortar, para quem esconde a imagem até lá.
 */
export const whenTrimmed = (
  src: string,
  file: IconFile | null,
  apply: (url: string) => void,
  settled?: () => void
): boolean => {
  if (!enabled) {
    return false;
  }
  const key = file?.path ?? src;
  if (ready.has(key)) {
    const cached = ready.get(key);
    if (cached) {
      apply(cached);
    }
    return false;
  }
  let pending = trimmed.get(key);
  if (!pending) {
    pending = enqueue(async () => await crop(src, file));
    trimmed.set(key, pending);
  }
  void (async () => {
    const url = await pending;
    ready.set(key, url);
    if (url) {
      apply(url);
    }
    settled?.();
  })();
  return true;
};

const TRIMMING_CLASS = "mdp-trimming";

/**
 * Faz `img` mostrar a versão cortada do ícone quando a opção está ligada.
 * Até ela ficar pronta, a imagem fica invisível, com o espaço guardado:
 * mostrar a original e depois trocar fazia o ícone mudar de tamanho na tela.
 * Sem o que cortar, a original aparece.
 */
export const trimIconImage = (
  img: HTMLImageElement,
  file: IconFile | null
): void => {
  const original = img.getAttribute("src");
  if (!original) {
    return;
  }
  const show = (): void => {
    img.removeClass(TRIMMING_CLASS);
  };
  const pending = whenTrimmed(
    original,
    file,
    (url) => {
      img.src = url;
    },
    () => {
      // A versão cortada é outra imagem: aparece quando terminar de abrir.
      if (img.complete) {
        show();
        return;
      }
      img.addEventListener("load", show, { once: true });
      img.addEventListener("error", show, { once: true });
    }
  );
  if (pending) {
    img.addClass(TRIMMING_CLASS);
  }
};
