/** O que a API de fontes locais devolve para cada fonte instalada. */
interface LocalFont {
  family: string;
}

type LocalFontsWindow = Window & {
  queryLocalFonts?: () => Promise<LocalFont[]>;
};

let cache: Promise<string[] | null> | null = null;

const load = async (): Promise<string[] | null> => {
  const { queryLocalFonts } = window as LocalFontsWindow;
  if (typeof queryLocalFonts !== "function") {
    return null;
  }
  try {
    const fonts = await queryLocalFonts.call(window);
    const families = new Set(fonts.map((font) => font.family));
    return [...families].toSorted((a, b) => a.localeCompare(b));
  } catch {
    // Sem permissão ou sem suporte: o campo de texto continua valendo.
    return null;
  }
};

/**
 * Famílias de fontes instaladas no sistema, em ordem alfabética, ou `null` se
 * o Obsidian não deixar listá-las. A lista é lida uma vez por sessão.
 */
export const installedFonts = (): Promise<string[] | null> => {
  cache ??= load();
  return cache;
};
