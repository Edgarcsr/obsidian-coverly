import type { App } from "obsidian";

import { cacheCoverInBackground, cachedCoverUrl } from "./cover-cache";
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
  positionX: "coverly-position-x",
  zoom: "coverly-zoom",
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
  FM.positionX,
  FM.zoom,
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
  /** Posição horizontal da foto, em %: 50 é centralizada. */
  positionX: number;
  /** Zoom da foto ou do degradê, em porcentagem: 100 é o encaixe padrão. */
  zoom: number;
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

/** Zoom padrão e limites, em porcentagem. Abaixo de 100 sobrariam bordas vazias. */
export const DEFAULT_ZOOM = 100;
export const ZOOM_STEP = 20;
const ZOOM_MAX = 300;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clampZoom = (value: number): number =>
  clamp(value, DEFAULT_ZOOM, ZOOM_MAX);

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
  const positionX = Number(read(fm, "positionX"));
  const zoom = Number(read(fm, "zoom"));
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
    positionX: Number.isFinite(positionX)
      ? clamp(positionX, 0, 100)
      : DEFAULT_POSITION,
    zoom: Number.isFinite(zoom) ? clampZoom(zoom) : DEFAULT_ZOOM,
  };
};

const URL_PATTERN = /^https?:\/\//u;

const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

/** Cor escolhida livremente: `#rrggbb`. */
export const isHexColor = (value: string): boolean => HEX_COLOR.test(value);

/** Capa que vem da internet (e pode ganhar uma cópia local). */
export const isRemoteCover = (value: string): boolean =>
  URL_PATTERN.test(value);

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

  if (isRemoteCover(value)) {
    // Com a cópia local ligada, a capa abre do disco; a primeira vez baixa.
    const local = cachedCoverUrl(value);
    if (local) {
      return { kind: "image", url: local };
    }
    cacheCoverInBackground(value);
    return { kind: "image", url: value };
  }

  const file = app.vault.getFileByPath(value);
  if (file) {
    return { kind: "image", url: app.vault.getResourcePath(file) };
  }

  // Arquivo removido do vault: cai no gradiente padrão em vez de quebrar a nota.
  return { css: GRADIENTS[0]?.css ?? "", kind: "gradient" };
};
