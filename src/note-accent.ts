import { iconColorCss } from "./page-icon";

/*
 * O Obsidian declara as variáveis derivadas no `body` (por exemplo
 * `--link-color: var(--text-accent)`), e um var() é resolvido onde a variável é
 * declarada: trocar só `--text-accent` na nota não muda os links. Por isso cada
 * variável que carrega a cor de destaque é trocada diretamente.
 */
const ACCENT_VARIABLES = [
  "--color-accent",
  "--interactive-accent",
  "--text-accent",
  "--link-color",
  "--link-external-color",
  "--link-unresolved-color",
  "--tag-color",
  "--checkbox-color",
] as const;

/** Variáveis de passar o mouse: a mesma cor, um pouco mais escura. */
const HOVER_VARIABLES = [
  "--interactive-accent-hover",
  "--text-accent-hover",
  "--link-color-hover",
  "--link-external-color-hover",
  "--tag-color-hover",
  "--checkbox-color-hover",
] as const;

/** Volta `el` à cor de destaque do tema. */
export const clearAccent = (el: HTMLElement): void => {
  if (el.dataset.mdpAccent === undefined) {
    return;
  }
  for (const name of [...ACCENT_VARIABLES, ...HOVER_VARIABLES]) {
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
  const hover = `color-mix(in srgb, ${css}, black 12%)`;
  for (const name of HOVER_VARIABLES) {
    el.style.setProperty(name, hover);
  }
  el.dataset.mdpAccent = color;
};
