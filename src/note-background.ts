import type { App } from "obsidian";

import { resolveCoverSource } from "./note-data";

/** Quanto do fundo do tema cobre a imagem, para o texto continuar legível. */
const DIM_PERCENT = 80;

const DIM_LAYER = `color-mix(in srgb, var(--background-primary) ${DIM_PERCENT}%, transparent)`;

const STYLE_PROPERTIES = [
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
] as const;

/** Tira o fundo de `el`, deixando o do tema. */
export const clearBackground = (el: HTMLElement): void => {
  if (el.dataset.mdpBackground === undefined) {
    return;
  }
  for (const property of STYLE_PROPERTIES) {
    el.style.removeProperty(property);
  }
  Reflect.deleteProperty(el.dataset, "mdpBackground");
  el.removeClass("mdp-has-background");
};

/**
 * Pinta o fundo da nota em `el` (a área de conteúdo da view): cor, gradiente ou
 * imagem, sempre sob uma camada do fundo do tema que o suaviza.
 */
export const paintBackground = (
  app: App,
  el: HTMLElement,
  value: string | undefined
): void => {
  if (!value) {
    clearBackground(el);
    return;
  }
  // Evita reescrever o estilo a cada passada de sincronização.
  if (el.dataset.mdpBackground === value) {
    return;
  }
  const source = resolveCoverSource(app, value);
  if (!source) {
    clearBackground(el);
    return;
  }

  // Aspas no caminho quebrariam a declaração CSS, então são escapadas.
  const layer =
    source.kind === "image"
      ? `url("${source.url.replaceAll('"', "%22")}")`
      : source.css;
  el.setCssStyles({
    backgroundImage: `linear-gradient(${DIM_LAYER}, ${DIM_LAYER}), ${layer}`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
  });
  el.dataset.mdpBackground = value;
  el.addClass("mdp-has-background");
};
