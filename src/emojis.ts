import EMOJI_DATA from "./emoji-data.json";
import { getLocale, t } from "./i18n";
import type { Locale, MessageKey } from "./i18n";

export interface EmojiEntry {
  emoji: string;
  /** Nome do emoji no idioma atual, mostrado na dica ao passar o mouse. */
  name: string;
  /** Nome e palavras-chave no idioma atual (com o nome no outro idioma), para o filtro. */
  keywords: string;
}

export interface EmojiGroup {
  name: string;
  /** Ícone Lucide do grupo na barra de categorias. */
  icon: string;
  emojis: EmojiEntry[];
}

/**
 * Grupos do Unicode, na ordem de emoji-data.json (gerado por
 * scripts/build-emojis.ts a partir do emojibase).
 */
const GROUPS: readonly { icon: string; label: MessageKey }[] = [
  { icon: "smile", label: "emojiGroup.smileys" },
  { icon: "hand", label: "emojiGroup.people" },
  { icon: "leaf", label: "emojiGroup.nature" },
  { icon: "apple", label: "emojiGroup.food" },
  { icon: "plane", label: "emojiGroup.travel" },
  { icon: "trophy", label: "emojiGroup.activities" },
  { icon: "lightbulb", label: "emojiGroup.objects" },
  { icon: "heart", label: "emojiGroup.symbols" },
  { icon: "flag", label: "emojiGroup.flags" },
];

/** Em emoji-data.json cada emoji é [emoji, nome pt, busca pt, nome en, busca en]. */
const COLUMNS: Record<Locale, { name: number; keywords: number }> = {
  en: { keywords: 4, name: 3 },
  pt: { keywords: 2, name: 1 },
};

/** Só o primeiro caractere em maiúscula: "rosto risonho" → "Rosto risonho". */
const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

const cache = new Map<Locale, EmojiEntry[][]>();

/** Emojis de cada grupo no idioma atual, montados uma vez por idioma. */
const entriesByGroup = (locale: Locale): EmojiEntry[][] => {
  let groups = cache.get(locale);
  if (!groups) {
    const column = COLUMNS[locale];
    groups = GROUPS.map((_, index) =>
      (EMOJI_DATA[index] ?? []).map((row) => ({
        emoji: row[0] ?? "",
        keywords: row[column.keywords] ?? "",
        name: capitalize(row[column.name] ?? ""),
      }))
    );
    cache.set(locale, groups);
  }
  return groups;
};

/** Os grupos da aba Emoji, na ordem em que aparecem, com os nomes no idioma atual. */
export const emojiGroups = (): EmojiGroup[] => {
  const entries = entriesByGroup(getLocale());
  return GROUPS.map((group, index) => ({
    emojis: entries[index] ?? [],
    icon: group.icon,
    name: t(group.label),
  }));
};
