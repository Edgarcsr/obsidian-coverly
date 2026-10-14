import { setIcon } from "obsidian";
import type { App } from "obsidian";

import type { MessageKey } from "./i18n";
import { drawEmoji } from "./twemoji";

/**
 * O ícone da página fica no frontmatter como texto: um emoji ("📚"), um
 * ícone Lucide prefixado, com a cor opcional no fim ("lucide:book-open" ou
 * "lucide:book-open:blue", ou em hexadecimal, "lucide:book-open:#1e90ff"), ou uma imagem, pelo link ou pelo caminho no vault.
 * O Obsidian já traz os Lucide com o id "lucide-<nome>".
 */
const LUCIDE_PREFIX = "lucide:";
const OBSIDIAN_LUCIDE_PREFIX = "lucide-";

export const URL_PATTERN = /^https?:\/\//u;

export interface IconColor {
  id: string;
  label: MessageKey;
  css: string;
}

/** Paleta das cores dos ícones: as do Notion ou as do Tailwind (a original). */
export type ColorPalette = "notion" | "tailwind";

/**
 * Paleta Tailwind da aba Ícones: a cor padrão, que acompanha o tema, e as
 * principais cores do Tailwind no tom 500. Os ids são os nomes do Tailwind.
 */
const TAILWIND_COLORS: IconColor[] = [
  { css: "var(--text-muted)", id: "default", label: "color.default" },
  { css: "#6b7280", id: "gray", label: "color.gray" },
  { css: "#ef4444", id: "red", label: "color.red" },
  { css: "#f97316", id: "orange", label: "color.orange" },
  { css: "#f59e0b", id: "amber", label: "color.amber" },
  { css: "#eab308", id: "yellow", label: "color.yellow" },
  { css: "#84cc16", id: "lime", label: "color.lime" },
  { css: "#22c55e", id: "green", label: "color.green" },
  { css: "#10b981", id: "emerald", label: "color.emerald" },
  { css: "#14b8a6", id: "teal", label: "color.teal" },
  { css: "#06b6d4", id: "cyan", label: "color.cyan" },
  { css: "#0ea5e9", id: "sky", label: "color.sky" },
  { css: "#3b82f6", id: "blue", label: "color.blue" },
  { css: "#6366f1", id: "indigo", label: "color.indigo" },
  { css: "#8b5cf6", id: "violet", label: "color.violet" },
  { css: "#a855f7", id: "purple", label: "color.purple" },
  { css: "#d946ef", id: "fuchsia", label: "color.fuchsia" },
  { css: "#ec4899", id: "pink", label: "color.pink" },
  { css: "#f43f5e", id: "rose", label: "color.rose" },
];

/**
 * Paleta do Notion. As cores mudam com o tema do Obsidian, então vêm de
 * variáveis CSS (`--mdp-notion-*`, no styles.css). Os ids que existem nas
 * duas paletas (red, blue...) são os mesmos, então as notas já gravadas só
 * trocam de tom.
 */
const NOTION_COLORS: IconColor[] = [
  { css: "var(--text-muted)", id: "default", label: "color.default" },
  { css: "var(--mdp-notion-gray)", id: "gray", label: "color.gray" },
  { css: "var(--mdp-notion-brown)", id: "brown", label: "color.brown" },
  { css: "var(--mdp-notion-orange)", id: "orange", label: "color.orange" },
  { css: "var(--mdp-notion-yellow)", id: "yellow", label: "color.yellow" },
  { css: "var(--mdp-notion-green)", id: "green", label: "color.green" },
  { css: "var(--mdp-notion-blue)", id: "blue", label: "color.blue" },
  { css: "var(--mdp-notion-purple)", id: "purple", label: "color.purple" },
  { css: "var(--mdp-notion-pink)", id: "pink", label: "color.pink" },
  { css: "var(--mdp-notion-red)", id: "red", label: "color.red" },
];

let palette: ColorPalette = "tailwind";

export const setColorPalette = (value: ColorPalette): void => {
  palette = value;
};

export const getColorPalette = (): ColorPalette => palette;

/** Cores oferecidas na aba Ícones, da paleta escolhida nas configurações. */
export const iconColors = (): IconColor[] =>
  palette === "notion" ? NOTION_COLORS : TAILWIND_COLORS;

export const DEFAULT_ICON_COLOR = "default";

const HEX_COLOR = /^#[\da-f]{6}$/iu;

/** Cor escolhida à mão, gravada como hexadecimal em vez de um id da paleta. */
export const isCustomColor = (id: string): boolean => HEX_COLOR.test(id);

/** Cor CSS de um id da paleta ou de um hexadecimal; o resto cai na padrão. */
export const iconColorCss = (id: string): string => {
  if (isCustomColor(id)) {
    return id;
  }
  // Um id que só existe na outra paleta (amber, brown...) ainda resolve, para
  // não deixar a nota sem cor ao trocar de paleta.
  const found = [...iconColors(), ...TAILWIND_COLORS, ...NOTION_COLORS].find(
    (color) => color.id === id
  );
  return found?.css ?? iconColors()[0]?.css ?? "";
};

export interface LucideIcon {
  name: string;
  color: string;
}

export const lucideValue = (name: string, color: string): string =>
  color === DEFAULT_ICON_COLOR
    ? `${LUCIDE_PREFIX}${name}`
    : `${LUCIDE_PREFIX}${name}:${color}`;

/** Ícone Lucide gravado na nota, ou `null` se não for um Lucide. */
export const parseLucide = (value: string): LucideIcon | null => {
  if (!value.startsWith(LUCIDE_PREFIX)) {
    return null;
  }
  const [name = "", color = DEFAULT_ICON_COLOR] = value
    .slice(LUCIDE_PREFIX.length)
    .split(":");
  return { color, name };
};

/** Nomes de todos os ícones Lucide do Obsidian, sem o prefixo, em ordem alfabética. */
export const lucideNames = (ids: readonly string[]): string[] =>
  ids
    .filter((id) => id.startsWith(OBSIDIAN_LUCIDE_PREFIX))
    .map((id) => id.slice(OBSIDIAN_LUCIDE_PREFIX.length))
    .toSorted();

/** Desenha um ícone Lucide pelo nome sem prefixo. */
export const drawLucide = (el: HTMLElement, name: string): void => {
  setIcon(el, `${OBSIDIAN_LUCIDE_PREFIX}${name}`);
};

/** Endereço da imagem do ícone, ou `null` se o ícone não for uma imagem. */
export const iconImageSource = (app: App, value: string): string | null => {
  if (URL_PATTERN.test(value)) {
    return value;
  }
  const file = app.vault.getFileByPath(value);
  return file ? app.vault.getResourcePath(file) : null;
};

/** O ícone é uma imagem (link ou arquivo do vault), não emoji nem Lucide. */
export const isImageIcon = (app: App, value: string): boolean =>
  iconImageSource(app, value) !== null;

/**
 * Desenha o ícone da página, emoji, Lucide ou imagem, dentro de `el`. Com
 * `twemoji`, o emoji sai no estilo do X em vez do emoji do sistema.
 */
export const drawPageIcon = (
  app: App,
  el: HTMLElement,
  value: string,
  twemoji: boolean
): void => {
  const lucide = parseLucide(value);
  const image = lucide === null ? iconImageSource(app, value) : null;
  el.toggleClass("is-lucide", lucide !== null);
  el.toggleClass("is-image", image !== null);
  if (lucide !== null) {
    drawLucide(el, lucide.name);
    el.style.color = iconColorCss(lucide.color);
  } else if (image === null) {
    drawEmoji(el, value, twemoji);
  } else {
    el.createEl("img", { attr: { alt: "", src: image } });
  }
};
