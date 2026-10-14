import { getLanguage } from "obsidian";

import { en } from "./en";
import { pt } from "./pt";
import type { MessageKey, Messages } from "./pt";

export type { MessageKey } from "./pt";

/** Idiomas com tradução. */
export type Locale = "pt" | "en";
/** O que o usuário escolhe nas configurações: um idioma ou seguir o Obsidian. */
export type Language = "auto" | Locale;

const MESSAGES: Record<Locale, Messages> = { en, pt };

let locale: Locale = "pt";

/** "auto" segue o idioma do Obsidian; o que não for português cai no inglês. */
const resolveLocale = (language: Language): Locale => {
  if (language !== "auto") {
    return language;
  }
  return getLanguage().toLowerCase().startsWith("pt") ? "pt" : "en";
};

export const setLanguage = (language: Language): void => {
  locale = resolveLocale(language);
};

export const getLocale = (): Locale => locale;

/** Texto no idioma atual; `{nome}` é trocado pelo valor em `params`. */
export const t = (
  key: MessageKey,
  params?: Record<string, string | number>
): string => {
  const text = MESSAGES[locale][key];
  if (!params) {
    return text;
  }
  return text.replaceAll(/\{(?<name>\w+)\}/gu, (match, name: string) =>
    String(params[name] ?? match)
  );
};
