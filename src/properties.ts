import { FM } from "./note-data";

/** Propriedades que o plugin esconde na nota (ver styles.css). */
const HIDDEN_KEYS: ReadonlySet<string> = new Set(Object.values(FM));

/**
 * Marca o contêiner da nota quando não sobra nenhuma propriedade visível, para
 * o CSS esconder o painel inteiro, inclusive "Adicionar propriedade".
 */
export const markEmptyProperties = (
  root: HTMLElement,
  frontmatter: Record<string, unknown> | null | undefined
): void => {
  const hasVisible = Object.keys(frontmatter ?? {}).some(
    (key) => !HIDDEN_KEYS.has(key)
  );
  root.toggleClass("mdp-props-empty", !hasVisible);
};
