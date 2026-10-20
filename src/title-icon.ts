import type { App } from "obsidian";

import { isIconTrimEnabled, whenTrimmed } from "./icon-trim";
import {
  drawLucide,
  iconColorCss,
  iconFile,
  iconImageSource,
  parseLucide,
} from "./page-icon";
import { cacheTwemoji, twemojiUrl } from "./twemoji";

/**
 * Ícone no título da barra superior da aba, desenhado como `::before` do
 * próprio título (ver styles.css), e não como um elemento ao lado dele:
 * - o título é editável (é por ali que se renomeia a nota), então um
 *   elemento dentro dele viraria parte do nome;
 * - como pseudo-elemento, o ícone faz parte do título: temas que escondem o
 *   título até o hover escondem e mostram o ícone junto.
 *
 * O CSS lê o tipo em `data-mdp-icon` e o conteúdo em variáveis/atributos.
 */
type TitleIconKind = "image" | "mask" | "text";

const KIND_ATTR = "data-mdp-icon";
const TEXT_ATTR = "data-mdp-icon-text";
const KEY_ATTR = "data-mdp-icon-key";
const IMAGE_VAR = "--mdp-title-icon-image";
const COLOR_VAR = "--mdp-title-icon-color";

const LUCIDE_STROKE = "2.5";
const SVG_NS = "http://www.w3.org/2000/svg";

const cssUrl = (url: string): string => `url("${url.replaceAll('"', "%22")}")`;

/** O SVG do Lucide como data URL, para servir de máscara (a cor vem do CSS). */
const lucideDataUrl = (name: string): string | null => {
  const holder = createDiv();
  drawLucide(holder, name);
  const svg = holder.querySelector("svg");
  if (!svg) {
    return null;
  }
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("stroke-width", LUCIDE_STROKE);
  return `data:image/svg+xml,${encodeURIComponent(svg.outerHTML)}`;
};

const setKind = (
  title: HTMLElement,
  kind: TitleIconKind,
  image = "",
  color = ""
): void => {
  title.setAttribute(KIND_ATTR, kind);
  title.style.setProperty(IMAGE_VAR, image);
  title.style.setProperty(COLOR_VAR, color);
};

const setText = (title: HTMLElement, emoji: string): void => {
  title.setAttribute(TEXT_ATTR, emoji);
  setKind(title, "text");
};

export const clearTitleIcon = (title: HTMLElement): void => {
  title.removeAttribute(KIND_ATTR);
  title.removeAttribute(TEXT_ATTR);
  title.removeAttribute(KEY_ATTR);
  title.style.removeProperty(IMAGE_VAR);
  title.style.removeProperty(COLOR_VAR);
};

/** Põe, troca ou tira o ícone do título. Não mexe no DOM se nada mudou. */
export const paintTitleIcon = (
  app: App,
  title: HTMLElement,
  value: string | undefined,
  twemoji: boolean
): void => {
  if (!value) {
    if (title.hasAttribute(KIND_ATTR)) {
      clearTitleIcon(title);
    }
    return;
  }
  const key = `${twemoji}\n${isIconTrimEnabled()}\n${value}`;
  if (title.getAttribute(KEY_ATTR) === key) {
    return;
  }
  clearTitleIcon(title);
  title.setAttribute(KEY_ATTR, key);

  const lucide = parseLucide(value);
  if (lucide !== null) {
    const url = lucideDataUrl(lucide.name);
    if (url) {
      setKind(title, "mask", cssUrl(url), iconColorCss(lucide.color));
    }
    return;
  }

  const image = iconImageSource(app, value);
  if (image !== null) {
    setKind(title, "image", cssUrl(image));
    whenTrimmed(image, iconFile(app, value), (url) => {
      if (title.getAttribute(KEY_ATTR) === key) {
        title.style.setProperty(IMAGE_VAR, cssUrl(url));
      }
    });
    return;
  }

  if (!twemoji) {
    setText(title, value);
    return;
  }
  // Como no cabeçalho: sem rede (ou sem Twemoji para o emoji), usa o texto.
  const url = twemojiUrl(value);
  setKind(title, "image", cssUrl(url));
  const probe = new Image();
  probe.addEventListener(
    "load",
    () => {
      cacheTwemoji(value);
    },
    { once: true }
  );
  probe.addEventListener(
    "error",
    () => {
      if (title.getAttribute(KEY_ATTR) === key) {
        setText(title, value);
      }
    },
    { once: true }
  );
  probe.src = url;
};
