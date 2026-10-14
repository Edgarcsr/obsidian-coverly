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
  // A cor de destaque do tema do Obsidian de quem usa; acompanha a troca de tema.
  {
    css: "var(--interactive-accent)",
    id: "theme-accent",
    label: "color.accent",
  },
  { css: "#6b7280", id: "gray", label: "color.gray" },
  { css: "#ef4444", id: "red", label: "color.red" },
  { css: "#f97316", id: "orange", label: "color.orange" },
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
 * Paleta do seletor de ícones do Notion, na ordem dele (duas linhas de cinco).
 * Os ids levam o prefixo `notion-`, então um ícone guarda de qual paleta é a
 * cor dele: trocar a paleta nas configurações só muda o que o seletor
 * oferece, e os ícones já gravados continuam como estavam.
 */
const NOTION_COLORS: IconColor[] = [
  { css: "var(--text-normal)", id: "notion-default", label: "color.default" },
  { css: "#7f7f7f", id: "notion-gray", label: "color.gray" },
  { css: "#aa755f", id: "notion-brown", label: "color.brown" },
  { css: "#ca8e1b", id: "notion-yellow", label: "color.yellow" },
  { css: "#d87620", id: "notion-orange", label: "color.orange" },
  { css: "#2d9964", id: "notion-green", label: "color.green" },
  { css: "#2e7cd1", id: "notion-blue", label: "color.blue" },
  { css: "#8d5bc1", id: "notion-purple", label: "color.purple" },
  { css: "#c94079", id: "notion-pink", label: "color.pink" },
  { css: "#cd4945", id: "notion-red", label: "color.red" },
];

/**
 * Cores que saíram do seletor (para a grade fechar em linhas de cinco), mas
 * seguem valendo nos ícones que já as usam.
 */
const LEGACY_COLORS: IconColor[] = [
  { css: "#f59e0b", id: "amber", label: "color.amber" },
];

const PALETTES: Record<ColorPalette, IconColor[]> = {
  notion: NOTION_COLORS,
  tailwind: TAILWIND_COLORS,
};

let palette: ColorPalette = "tailwind";

export const setColorPalette = (value: ColorPalette): void => {
  palette = value;
};

/** Cores oferecidas no seletor, da paleta escolhida nas configurações. */
export const iconColors = (): IconColor[] => PALETTES[palette];

/** O seletor de cor livre só existe na paleta Tailwind; a do Notion é fechada. */
export const allowsCustomColor = (): boolean => palette === "tailwind";

export const DEFAULT_ICON_COLOR = "default";

const HEX_COLOR = /^#[\da-f]{6}$/iu;

/** Cor escolhida à mão, gravada como hexadecimal em vez de um id da paleta. */
export const isCustomColor = (id: string): boolean => HEX_COLOR.test(id);

/** Cor CSS de um id da paleta ou de um hexadecimal; o resto cai na padrão. */
export const iconColorCss = (id: string): string => {
  if (isCustomColor(id)) {
    return id;
  }
  // Resolve pelo id, de qualquer paleta, e não pela ativa: cada ícone mantém a
  // cor com que foi gravado.
  const found = [...Object.values(PALETTES).flat(), ...LEGACY_COLORS].find(
    (color) => color.id === id
  );
  return found?.css ?? TAILWIND_COLORS[0]?.css ?? "";
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
