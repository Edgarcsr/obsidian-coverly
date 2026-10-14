/**
 * Emojis desenhados no estilo do X (Twemoji). As imagens vêm do jsDelivr sob
 * demanda e ficam no cache do navegador; sem rede, cai no emoji do sistema.
 */
const TWEMOJI_BASE = "https://cdn.jsdelivr.net/npm/@twemoji/svg@15.0.0/";

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

export const twemojiUrl = (emoji: string): string =>
  `${TWEMOJI_BASE}${twemojiCode(emoji)}.svg`;

/**
 * Desenha o emoji dentro de `el`: a imagem do Twemoji, ou o próprio texto se
 * o estilo nativo estiver ativo ou a imagem não carregar.
 */
export const drawEmoji = (
  el: HTMLElement,
  emoji: string,
  twemoji: boolean,
  // Na grade do seletor são centenas de imagens: só baixa as que aparecem.
  lazy = false
): void => {
  el.empty();
  if (!twemoji) {
    el.setText(emoji);
    return;
  }
  const img = el.createEl("img", {
    attr: {
      alt: emoji,
      draggable: "false",
      loading: lazy ? "lazy" : "eager",
      src: twemojiUrl(emoji),
    },
    cls: "mdp-twemoji",
  });
  img.addEventListener(
    "error",
    () => {
      el.empty();
      el.setText(emoji);
    },
    { once: true }
  );
};
