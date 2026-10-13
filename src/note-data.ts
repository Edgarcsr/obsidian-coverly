import type { App } from "obsidian";

import { GRADIENTS } from "./gallery";

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
