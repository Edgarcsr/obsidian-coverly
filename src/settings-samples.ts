import type { TFile } from "obsidian";

import { t } from "./i18n";
import type CoverlyPlugin from "./main";
import { dataFromFrontmatter, isHexColor } from "./note-data";
import type { CoverData } from "./note-data";
import { vaultImages } from "./vault-images";

/**
 * Notas reais do vault para as prévias das configurações: o nome, o ícone e a
 * capa são os dela, e o que o vault não tem vira um exemplo neutro. Tudo é
 * lido do cache de metadados, sem abrir arquivo nem usar a rede.
 */
export interface Sample {
  name: string;
  data: CoverData;
}

export interface Samples {
  /** Nota para o cabeçalho: de preferência com capa e ícone. */
  hero: Sample;
  /** Notas com ícone, para a lista do explorador. */
  iconed: Sample[];
  /** Notas sem ícone nem capa. */
  plain: Sample[];
  /** Nota com foto na capa, para os fundos do explorador. */
  photo: Sample | null;
  /** Uma imagem do vault, para os fundos do explorador. */
  image: TFile | null;
}

const MAX_ICONED = 2;
const MAX_PLAIN = 2;
/** Para não repetir a busca a cada linha que as configurações desenham. */
const CACHE_MS = 3000;

/** Ícones dos exemplos quando o vault não tem notas com ícone. */
const EXAMPLE_ICONS = ["lucide:book-open", "lucide:star"];

let cache: { at: number; samples: Samples } | null = null;

const emptyData = (icon?: string): CoverData => ({
  icon,
  position: 50,
  positionX: 50,
  zoom: 100,
});

const isPhoto = (cover: string | undefined): boolean =>
  Boolean(cover) && !cover?.startsWith("gradient:") && !isHexColor(cover ?? "");

/** O que a busca nas notas já achou. */
interface Found {
  both: Sample | null;
  covered: Sample | null;
  photo: Sample | null;
  iconed: Sample[];
  plain: Sample[];
}

/** Põe a nota nos grupos a que ela serve, sem passar do que a prévia usa. */
const collect = (found: Found, sample: Sample): void => {
  const { cover, icon } = sample.data;
  found.both ??= cover && icon ? sample : null;
  found.covered ??= cover ? sample : null;
  found.photo ??= isPhoto(cover) ? sample : null;
  if (icon && found.iconed.length < MAX_ICONED) {
    found.iconed.push(sample);
  }
  if (!(icon || cover) && found.plain.length < MAX_PLAIN) {
    found.plain.push(sample);
  }
};

const isComplete = (found: Found): boolean =>
  found.both !== null &&
  found.photo !== null &&
  found.iconed.length >= MAX_ICONED &&
  found.plain.length >= MAX_PLAIN;

const scan = (plugin: CoverlyPlugin): Samples => {
  const { metadataCache, vault } = plugin.app;
  const found: Found = {
    both: null,
    covered: null,
    iconed: [],
    photo: null,
    plain: [],
  };
  for (const file of vault.getMarkdownFiles()) {
    const frontmatter = metadataCache.getFileCache(file)?.frontmatter;
    collect(found, {
      data: dataFromFrontmatter(frontmatter),
      name: file.basename,
    });
    if (isComplete(found)) {
      break;
    }
  }

  const example = t("settings.preview.note");
  const iconed = [...found.iconed];
  for (const icon of EXAMPLE_ICONS) {
    if (iconed.length < MAX_ICONED) {
      iconed.push({ data: emptyData(icon), name: example });
    }
  }
  return {
    hero: found.both ??
      found.covered ??
      iconed[0] ?? {
        data: emptyData(),
        name: example,
      },
    iconed,
    image: vaultImages(plugin.app)[0] ?? null,
    photo: found.photo,
    plain:
      found.plain.length > 0
        ? found.plain
        : [{ data: emptyData(), name: example }],
  };
};

export const sampleNotes = (plugin: CoverlyPlugin): Samples => {
  const now = Date.now();
  if (!cache || now - cache.at > CACHE_MS) {
    cache = { at: now, samples: scan(plugin) };
  }
  return cache.samples;
};
