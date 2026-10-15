import { iconColorCss } from "./page-icon";

/** Variáveis do tema que carregam a cor de destaque (links, botões, caixas de seleção). */
const ACCENT_VARIABLES = [
  "--color-accent",
  "--interactive-accent",
  "--interactive-accent-hover",
  "--text-accent",
  "--text-accent-hover",
] as const;

/** Volta `el` à cor de destaque do tema. */
export const clearAccent = (el: HTMLElement): void => {
  if (el.dataset.mdpAccent === undefined) {
    return;
  }
  for (const name of ACCENT_VARIABLES) {
    el.style.removeProperty(name);
  }
  Reflect.deleteProperty(el.dataset, "mdpAccent");
};

/**
 * Troca a cor de destaque do Obsidian só dentro de `el` (a área de conteúdo da
 * nota): o resto da interface e as outras notas seguem a cor do tema.
 */
export const paintAccent = (
  el: HTMLElement,
  color: string | undefined
): void => {
  if (!color) {
    clearAccent(el);
    return;
  }
  // Evita reescrever o estilo a cada passada de sincronização.
  if (el.dataset.mdpAccent === color) {
    return;
  }
  const css = iconColorCss(color);
  for (const name of ACCENT_VARIABLES) {
    el.style.setProperty(name, css);
  }
  el.dataset.mdpAccent = color;
};
