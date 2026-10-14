/*
 * Fica separado de twemoji.ts, que usa a API do Obsidian, para o
 * scripts/build-emojis.ts poder usar fora do app.
 */
const ZWJ = "‍";
const VARIATION_SELECTOR = /️/gu;

/**
 * Nome do arquivo no Twemoji: os code points em hexadecimal, separados por
 * hífen. O seletor de variação (FE0F) sai, exceto em sequências com ZWJ.
 */
export const twemojiCode = (emoji: string): string => {
  const text = emoji.includes(ZWJ)
    ? emoji
    : emoji.replaceAll(VARIATION_SELECTOR, "");
  return [...text]
    .map((char) => char.codePointAt(0)?.toString(16) ?? "")
    .join("-");
};
