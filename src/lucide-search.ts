import LUCIDE_DATA from "./lucide-data.json";

/**
 * Busca da aba Ícones como a do lucide.dev: além do nome, procura nas tags
 * ("money" acha "banknote") e nas categorias de cada ícone. Os dados vêm de
 * lucide-data.json, gerado por scripts/build-lucide.ts.
 */

/** Nome das categorias do Lucide em português, para buscar também por elas. */
const CATEGORY_LABELS: Record<string, string> = {
  accessibility: "acessibilidade",
  account: "contas acesso",
  animals: "animais",
  arrows: "setas",
  buildings: "construções prédios",
  charts: "gráficos",
  communication: "comunicação",
  connectivity: "conectividade",
  cursors: "cursores",
  design: "design",
  development: "programação desenvolvimento código",
  devices: "dispositivos",
  emoji: "emoji",
  files: "arquivos",
  finance: "finanças dinheiro",
  "food-beverage": "comida bebida",
  gaming: "jogos",
  home: "casa",
  layout: "layout",
  mail: "email correio",
  math: "matemática",
  medical: "medicina saúde",
  multimedia: "multimídia",
  nature: "natureza",
  navigation: "navegação lugares",
  notifications: "notificações",
  people: "pessoas",
  photography: "fotografia",
  science: "ciência",
  seasons: "estações",
  security: "segurança",
  shapes: "formas",
  shopping: "compras",
  social: "social",
  sports: "esportes",
  sustainability: "sustentabilidade",
  text: "texto formatação",
  time: "tempo calendário",
  tools: "ferramentas",
  transportation: "transporte",
  travel: "viagem",
  weather: "clima tempo",
};

const DIACRITICS = /\p{Diacritic}/gu;
const SEPARATORS = /[\s-]+/u;

/** Minúsculas e sem acento, para "financas" achar "finanças". */
export const normalize = (value: string): string =>
  value.normalize("NFD").replaceAll(DIACRITICS, "").toLowerCase().trim();

const ICONS = LUCIDE_DATA.icons as unknown as Record<
  string,
  [string, number[]]
>;

/** Texto em que a busca procura: tags e categorias (em inglês e português). */
const haystackCache = new Map<string, string>();
const haystack = (name: string): string => {
  let text = haystackCache.get(name);
  if (text === undefined) {
    const [tags = "", categories = []] = ICONS[name] ?? [];
    const labels = categories.map((index) => {
      const id = LUCIDE_DATA.categories[index] ?? "";
      return `${id} ${CATEGORY_LABELS[id] ?? ""}`;
    });
    text = normalize(`${tags} ${labels.join(" ")}`);
    haystackCache.set(name, text);
  }
  return text;
};

/**
 * Quão bem o ícone bate com a busca; menor é melhor, `null` é fora. Os nomes
 * são em inglês e com hífen: "arrow up" vira "arrow-up".
 */
const rank = (name: string, words: string[], joined: string): number | null => {
  if (name === joined) {
    return 0;
  }
  if (name.startsWith(joined)) {
    return 1;
  }
  if (name.includes(joined)) {
    return 2;
  }
  if (words.every((word) => name.includes(word))) {
    return 3;
  }
  const text = haystack(name);
  if (words.every((word) => name.includes(word) || text.includes(word))) {
    return 4;
  }
  return null;
};

/**
 * Ícones que batem com a busca, os mais relevantes primeiro: o nome exato,
 * nomes que começam ou contêm a busca, e por fim os achados pelas tags e
 * categorias. Cada palavra da busca precisa aparecer em algum lugar.
 */
export const searchLucide = (
  names: readonly string[],
  query: string
): string[] => {
  const words = normalize(query).split(SEPARATORS).filter(Boolean);
  if (words.length === 0) {
    return [...names];
  }
  const joined = words.join("-");
  const ranked: string[][] = [[], [], [], [], []];
  for (const name of names) {
    const tier = rank(name, words, joined);
    if (tier !== null) {
      ranked[tier]?.push(name);
    }
  }
  return ranked.flat();
};
