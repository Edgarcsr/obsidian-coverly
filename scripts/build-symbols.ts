/**
 * Gera src/symbols-data.json com os ícones de pasta da aba Pastas, tirados do
 * react-symbols (os ícones Symbols de Miguel Solorio). O pacote só traz
 * componentes React; aqui cada um vira o SVG puro, e o React não chega ao
 * main.js. Só entram os ícones da lista abaixo, na ordem da grade.
 *
 * Os ids ficam gravados nas notas e nas pastas: nunca tire um da lista.
 *
 * Uso: bun scripts/build-symbols.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import * as folders from "@react-symbols/icons/folders";
import { createElement } from "react";
import type { FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const COLORS: [string, string][] = [
  ["Gray", "cinza gray grey"],
  ["Red", "vermelho red"],
  ["Orange", "laranja orange"],
  ["Yellow", "amarelo yellow"],
  ["Green", "verde green"],
  ["Sky", "céu celeste azul claro sky light blue"],
  ["Blue", "azul blue"],
  ["Purple", "roxo violeta purple violet"],
  ["Pink", "rosa pink"],
];

const STYLES: [string, string][] = [
  ["", ""],
  ["Outline", "contorno vazado outline"],
  ["Code", "código programação code"],
];

const THEMES: [string, string][] = [
  ["Folder", "pasta padrão folder default"],
  ["FolderDocuments", "documentos arquivos documents files"],
  ["FolderImages", "imagens fotos images photos pictures"],
  ["FolderFonts", "fontes letras fonts typography"],
  ["FolderMail", "email correio cartas mail letters"],
  ["FolderLock", "cadeado privado segredo lock private secret"],
  ["FolderAssets", "recursos mídia formas assets media shapes"],
  ["FolderConfig", "configurações ajustes engrenagem config settings gear"],
  ["FolderI18n", "idiomas tradução línguas i18n languages translation"],
  ["FolderGithub", "github git repositório repository"],
  ["FolderClaude", "claude ia inteligência artificial ai"],
];

/** "FolderBlueOutline" → "folder-blue-outline". */
const kebab = (name: string): string =>
  name.replaceAll(/(?<=[a-z\d])(?=[A-Z])/gu, "-").toLowerCase();

const entries: [string, string][] = [
  ...STYLES.flatMap(([style, styleWords]) =>
    COLORS.map(([color, colorWords]): [string, string] => [
      `Folder${color}${style}`,
      `pasta folder ${colorWords} ${styleWords}`.trim(),
    ])
  ),
  ...THEMES,
];

const components = folders as unknown as Record<string, FC | undefined>;

// Por ícone: o id, as palavras da busca e o SVG.
const icons = entries.map(([name, keywords]): [string, string, string] => {
  const component = components[name];
  if (!component) {
    throw new Error(`${name} não existe no react-symbols`);
  }
  const svg = renderToStaticMarkup(createElement(component));
  return [kebab(name), keywords, svg];
});

const out = path.join(import.meta.dir, "..", "src", "symbols-data.json");
writeFileSync(out, `${JSON.stringify(icons)}\n`);
const size = icons.reduce((total, icon) => total + icon[2].length, 0);
console.log(
  `${icons.length} ícones, ${Math.round(size / 1024)} KB de SVG em ${out}`
);
