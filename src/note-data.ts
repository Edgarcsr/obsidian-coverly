import type { App } from "obsidian";

import { GRADIENTS } from "./gallery";

/**
 * Nomes das propriedades gravadas no frontmatter da nota. O prefixo `coverly-`
 * evita conflito com outros plugins que também usam `cover` e `icon`.
 */
export const FM = {
  accent: "coverly-accent",
  background: "coverly-background",
  color: "coverly-color",
  cover: "coverly-cover",
  credit: "coverly-credit",
  creditUrl: "coverly-credit-url",
  font: "coverly-font",
  icon: "coverly-icon",
  position: "coverly-position",
} as const;

/** Nomes usados antes do prefixo. Ainda são lidos e migrados ao gravar a nota. */
export const LEGACY_FM: Partial<Record<keyof typeof FM, string>> = {
  cover: "cover",
  credit: "cover-credit",
  creditUrl: "cover-credit-url",
  icon: "icon",
  position: "cover-position",
};

/** Chaves removidas quando a capa é tirada da nota. */
export const COVER_KEYS: readonly string[] = [
  FM.cover,
  FM.position,
  FM.credit,
  FM.creditUrl,
];

/** Move para os nomes com prefixo o que estiver gravado com os nomes antigos. */
export const migrateLegacyKeys = (fm: Record<string, unknown>): void => {
  for (const name of Object.keys(FM) as (keyof typeof FM)[]) {
    const legacy = LEGACY_FM[name];
    if (!legacy || !(legacy in fm)) {
      continue;
    }
    if (!(FM[name] in fm)) {
      fm[FM[name]] = fm[legacy];
    }
    Reflect.deleteProperty(fm, legacy);
  }
};

/** Valor da propriedade com prefixo; sem ela, cai no nome antigo. */
const read = (
  fm: Record<string, unknown> | null | undefined,
  name: keyof typeof FM
): unknown => {
  const legacy = LEGACY_FM[name];
  return fm?.[FM[name]] ?? (legacy ? fm?.[legacy] : undefined);
};

export interface CoverData {
  accent?: string;
  background?: string;
  color?: string;
  cover?: string;
  position: number;
  icon?: string;
  credit?: string;
  creditUrl?: string;
  /** Fonte pronta (serif, mono) ou o nome de uma personalizada. */
  font?: string;
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
  const position = Number(read(fm, "position"));
  return {
    accent: text(read(fm, "accent")),
    background: text(read(fm, "background")),
    color: text(read(fm, "color")),
    cover: text(read(fm, "cover")),
    credit: text(read(fm, "credit")),
    creditUrl: text(read(fm, "creditUrl")),
    font: text(read(fm, "font")),
    icon: text(read(fm, "icon")),
    position: Number.isFinite(position)
      ? clamp(position, 0, 100)
      : DEFAULT_POSITION,
  };
};

const URL_PATTERN = /^https?:\/\//u;

const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

/** Cor escolhida livremente: `#rrggbb`. */
export const isHexColor = (value: string): boolean => HEX_COLOR.test(value);

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

  if (isHexColor(value)) {
    // Cor livre: um gradiente de uma cor só cabe na mesma camada dos demais.
    return { css: `linear-gradient(${value}, ${value})`, kind: "gradient" };
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
