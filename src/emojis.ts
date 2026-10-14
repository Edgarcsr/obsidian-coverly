import EMOJI_DATA from "./emoji-data.json";

export interface EmojiEntry {
  emoji: string;
  /** Nome e palavras-chave em português, mais o nome em inglês, para o filtro. */
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
const GROUPS: readonly Omit<EmojiGroup, "emojis">[] = [
  { icon: "smile", name: "Sorrisos e emoção" },
  { icon: "hand", name: "Pessoas e corpo" },
  { icon: "leaf", name: "Animais e natureza" },
  { icon: "apple", name: "Comida e bebida" },
  { icon: "plane", name: "Viagens e lugares" },
  { icon: "trophy", name: "Atividades" },
  { icon: "lightbulb", name: "Objetos" },
  { icon: "heart", name: "Símbolos" },
  { icon: "flag", name: "Bandeiras" },
];

/** Todos os emojis da aba Emoji, em grupos na ordem em que aparecem. */
export const EMOJI_GROUPS: EmojiGroup[] = GROUPS.map((group, index) => ({
  ...group,
  emojis: (EMOJI_DATA[index] ?? []).map(([emoji = "", keywords = ""]) => ({
    emoji,
    keywords,
  })),
}));
