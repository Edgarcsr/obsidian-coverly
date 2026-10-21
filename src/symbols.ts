import { normalize } from "./lucide-search";
import symbolsData from "./symbols-data.json";

/**
 * Ícones de pasta da aba Pastas, do react-symbols (ver
 * scripts/build-symbols.ts). Ficam gravados com o prefixo, como
 * "symbols:folder-blue"; já vêm coloridos, então não levam cor.
 */
const SYMBOLS_PREFIX = "symbols:";
const WORD_SEPARATORS = /\s+/u;

export interface SymbolEntry {
  id: string;
  /** Palavras da busca, já normalizadas. */
  keywords: string;
  /** O SVG como data URL, pronto para `<img>` e para o CSS. */
  url: string;
}

const entries: SymbolEntry[] = (symbolsData as [string, string, string][]).map(
  ([id, keywords, svg]) => ({
    id,
    keywords: normalize(`${id} ${keywords}`),
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
  })
);

const byId = new Map(entries.map((entry) => [entry.id, entry]));

/** Todos os ícones, na ordem da grade. */
export const symbolEntries = (): readonly SymbolEntry[] => entries;

export const symbolValue = (id: string): string => `${SYMBOLS_PREFIX}${id}`;

/** Id do ícone gravado, ou `null` se o valor não for um ícone de pasta. */
export const parseSymbol = (value: string): string | null =>
  value.startsWith(SYMBOLS_PREFIX) ? value.slice(SYMBOLS_PREFIX.length) : null;

/**
 * Data URL do ícone gravado em `value`, ou `null` se não for um conhecido.
 * Com o prefixo e um id que não existe, quem desenha não mostra nada.
 */
export const symbolUrl = (value: string): string | null => {
  const id = parseSymbol(value);
  return id === null ? null : (byId.get(id)?.url ?? null);
};

/** Ícones cuja busca contém todas as palavras de `query`. */
export const searchSymbols = (query: string): SymbolEntry[] => {
  const words = normalize(query).split(WORD_SEPARATORS).filter(Boolean);
  return entries.filter((entry) =>
    words.every((word) => entry.keywords.includes(word))
  );
};
