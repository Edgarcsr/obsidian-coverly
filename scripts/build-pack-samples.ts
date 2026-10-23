/**
 * Gera src/icon-pack-samples.json com alguns ícones de cada pacote do
 * catálogo, para a página do pacote nas configurações mostrar como ele é
 * antes de ser instalado. Os pacotes inteiros não entram no main.js: são
 * baixados só quando a pessoa pede (ver src/icon-pack-catalog.ts).
 *
 * As versões saem de src/icon-pack-catalog.ts, para os exemplos serem os
 * mesmos ícones que a instalação traz.
 *
 * Uso: bun scripts/build-pack-samples.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

const JSDELIVR = "https://cdn.jsdelivr.net";

const SYMBOLS = {
  repo: "miguelsolorio/vscode-symbols",
  version: "0.0.26",
};

/** Nomes dos exemplos, na ordem em que aparecem. */
const SAMPLES = {
  phosphor: [
    "house",
    "folder",
    "file-text",
    "book-open",
    "star",
    "heart",
    "bookmark",
    "calendar",
    "lightbulb",
    "code",
    "image",
    "gear",
  ],
  symbols: [
    "folder-blue",
    "folder-green",
    "folder-red",
    "folder-orange",
    "folder-purple",
    "folder-pink",
    "folder-github",
    "folder-images",
  ],
  tabler: [
    "home",
    "folder",
    "file-text",
    "book",
    "star",
    "heart",
    "bookmark",
    "calendar",
    "bulb",
    "code",
    "photo",
    "settings",
  ],
};

const ICONIFY = {
  phosphor: { pkg: "@iconify-json/ph", version: "1.2.2" },
  tabler: { pkg: "@iconify-json/tabler", version: "1.2.42" },
} as const;

interface IconifyIcon {
  body: string;
  width?: number;
  height?: number;
}

interface IconifyJson {
  icons: Record<string, IconifyIcon>;
  width?: number;
  height?: number;
}

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return await response.text();
};

const iconify = async (
  id: "phosphor" | "tabler"
): Promise<[string, string][]> => {
  const { pkg, version } = ICONIFY[id];
  const text = await fetchText(`${JSDELIVR}/npm/${pkg}@${version}/icons.json`);
  const data = JSON.parse(text) as IconifyJson;
  return SAMPLES[id].map((name): [string, string] => {
    const icon = data.icons[name];
    if (!icon) {
      throw new Error(`${id}: ${name} não existe`);
    }
    const width = icon.width ?? data.width ?? 16;
    const height = icon.height ?? data.height ?? 16;
    return [
      name,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`,
    ];
  });
};

const symbols = async (): Promise<[string, string][]> =>
  await Promise.all(
    SAMPLES.symbols.map(async (name): Promise<[string, string]> => {
      const url = `${JSDELIVR}/gh/${SYMBOLS.repo}@${SYMBOLS.version}/src/icons/folders/${name}.svg`;
      return [name, await fetchText(url)];
    })
  );

const [phosphor, tabler, symbolIcons] = await Promise.all([
  iconify("phosphor"),
  iconify("tabler"),
  symbols(),
]);

const out = path.join(import.meta.dir, "..", "src", "icon-pack-samples.json");
const data = { phosphor, symbols: symbolIcons, tabler };
writeFileSync(out, `${JSON.stringify(data)}\n`);
const size = JSON.stringify(data).length;
console.log(`${Math.round(size / 1024)} KB em ${out}`);
