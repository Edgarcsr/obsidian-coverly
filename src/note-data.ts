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

export const GRADIENTS: GradientPreset[] = [
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
