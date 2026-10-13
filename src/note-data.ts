import type { App } from "obsidian";

/** Nomes das propriedades gravadas no frontmatter da nota. */
export const FM = {
  cover: "cover",
  credit: "cover-credit",
  creditUrl: "cover-credit-url",
  icon: "icon",
  position: "cover-position",
} as const;

/** Chaves removidas quando a capa é tirada da nota. */
export const COVER_KEYS: readonly string[] = [
  FM.cover,
  FM.position,
  FM.credit,
  FM.creditUrl,
];

export interface CoverData {
  cover?: string;
  position: number;
  icon?: string;
  credit?: string;
  creditUrl?: string;
}

export interface CreditInfo {
  name: string;
  url: string;
}

export interface GradientPreset {
  id: string;
  name: string;
  css: string;
}

export interface GallerySection {
  title: string;
  items: GradientPreset[];
}

/** Cor sólida no mesmo formato dos gradientes, para caber na mesma camada da capa. */
const solid = (color: string): string => `linear-gradient(${color}, ${color})`;

const COLORS_AND_GRADIENTS: GradientPreset[] = [
  { css: solid("#e8555a"), id: "red", name: "Vermelho" },
  { css: solid("#f7be4f"), id: "yellow", name: "Amarelo" },
  { css: solid("#1f96d1"), id: "blue", name: "Azul" },
  { css: solid("#fdefe3"), id: "cream", name: "Creme" },
  {
    css: "linear-gradient(180deg, #5fd4d6 0%, #e8b7a8 100%)",
    id: "lagoon",
    name: "Lagoa",
  },
  {
    css: "linear-gradient(135deg, #ff3d8b 0%, #ff2477 100%)",
    id: "magenta",
    name: "Magenta",
  },
  {
    css: "linear-gradient(160deg, #d9674c 0%, #f61c0a 100%)",
    id: "fire",
    name: "Fogo",
  },
  {
    css: "radial-gradient(circle at 30% 25%, #f5c2b8 0%, transparent 55%), linear-gradient(180deg, #fbe3dc 0%, #8fc4dc 100%)",
    id: "haze",
    name: "Névoa",
  },
  {
    css: "radial-gradient(circle at 12% 88%, #f2a6d6 0%, transparent 45%), linear-gradient(120deg, #2a5ea8 0%, #8e3a6f 55%, #e2381c 100%)",
    id: "nebula",
    name: "Nebulosa",
  },
  {
    css: "linear-gradient(160deg, #5d3fd3 0%, #c0466c 100%)",
    id: "violet",
    name: "Violeta",
  },
  {
    css: "linear-gradient(135deg, #1f4167 0%, #c9a08a 100%)",
    id: "dusk",
    name: "Crepúsculo",
  },
];

const PASTEL: GradientPreset[] = [
  {
    css: "linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)",
    id: "ocean",
    name: "Oceano",
  },
  {
    css: "linear-gradient(120deg, #ff9a9e 0%, #fecfef 60%, #fad0c4 100%)",
    id: "sunset",
    name: "Pôr do sol",
  },
  {
    css: "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
    id: "forest",
    name: "Floresta",
  },
  {
    css: "linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)",
    id: "lavender",
    name: "Lavanda",
  },
  {
    css: "linear-gradient(120deg, #ffecd2 0%, #fcb69f 100%)",
    id: "peach",
    name: "Pêssego",
  },
  {
    css: "linear-gradient(120deg, #2c3e50 0%, #4ca1af 100%)",
    id: "night",
    name: "Noite",
  },
  {
    css: "linear-gradient(120deg, #f6d365 0%, #fda085 100%)",
    id: "sand",
    name: "Areia",
  },
  {
    css: "linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)",
    id: "mint",
    name: "Menta",
  },
  {
    css: "linear-gradient(120deg, #43e97b 0%, #38f9d7 100%)",
    id: "aurora",
    name: "Aurora",
  },
  {
    css: "linear-gradient(120deg, #fbc2eb 0%, #a6c1ee 100%)",
    id: "rose",
    name: "Rosa",
  },
  {
    css: "linear-gradient(120deg, #bdc3c7 0%, #2c3e50 100%)",
    id: "slate",
    name: "Ardósia",
  },
  {
    css: "linear-gradient(120deg, #f12711 0%, #f5af19 100%)",
    id: "ember",
    name: "Brasa",
  },
];

/** Seções da aba Galeria, na ordem em que aparecem. */
export const GALLERY: GallerySection[] = [
  { items: COLORS_AND_GRADIENTS, title: "Cor e gradiente" },
  { items: PASTEL, title: "Pastel" },
];

/** Todas as capas prontas. Os ids ficam gravados na nota como `gradient:<id>`. */
export const GRADIENTS: GradientPreset[] = GALLERY.flatMap(
  (section) => section.items
);

export type CoverSource =
  | { kind: "gradient"; css: string }
  | { kind: "image"; url: string };

const DEFAULT_POSITION = 50;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const text = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

/** Lê os dados de capa a partir do frontmatter já processado pelo Obsidian. */
export const dataFromFrontmatter = (
  fm: Record<string, unknown> | null | undefined
): CoverData => {
  const position = Number(fm?.[FM.position]);
  return {
    cover: text(fm?.[FM.cover]),
    credit: text(fm?.[FM.credit]),
    creditUrl: text(fm?.[FM.creditUrl]),
    icon: text(fm?.[FM.icon]),
    position: Number.isFinite(position)
      ? clamp(position, 0, 100)
      : DEFAULT_POSITION,
  };
};

const URL_PATTERN = /^https?:\/\//u;

export const resolveCoverSource = (
  app: App,
  value: string | undefined
): CoverSource | null => {
  if (!value) {
    return null;
  }

  if (value.startsWith("gradient:")) {
    const preset =
      GRADIENTS.find((g) => `gradient:${g.id}` === value) ?? GRADIENTS[0];
    return { css: preset?.css ?? "", kind: "gradient" };
  }

  if (URL_PATTERN.test(value)) {
    return { kind: "image", url: value };
  }

  const file = app.vault.getFileByPath(value);
  if (file) {
    return { kind: "image", url: app.vault.getResourcePath(file) };
  }

  // Arquivo removido do vault: cai no gradiente padrão em vez de quebrar a nota.
  return { css: GRADIENTS[0]?.css ?? "", kind: "gradient" };
};
