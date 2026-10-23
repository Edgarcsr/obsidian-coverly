/**
 * Gera src/lucide-extra.json com os ícones do Lucide que o Obsidian não traz
 * (ele embute só parte do conjunto, e de uma versão mais antiga). Os ícones
 * vêm do @iconify-json/lucide e do @lucide/lab (o Lucide Lab, com ícones da
 * comunidade, do pacote oficial, que é mais novo que a cópia do Iconify), pelo
 * jsDelivr; quais faltam é lido do próprio
 * Obsidian instalado, do mapa de ícones dentro do obsidian.asar. Ícones que o
 * Obsidian já tem com o nome antigo (um alias) não entram, para não aparecerem
 * duas vezes.
 *
 * Só entram ícones que o lucide.dev ainda lista (src/lucide-data.json, de
 * scripts/build-lucide.ts, que deve rodar antes): o Iconify guarda também os
 * que o Lucide removeu, como os de marcas.
 *
 * No plugin, o ícone só vem daqui quando o Obsidian não o tem, então numa
 * versão nova dele que já traga o ícone, vale o do Obsidian.
 *
 * Uso: bun scripts/build-lucide-extra.ts [caminho do obsidian.asar]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ICONIFY = { pkg: "@iconify-json/lucide", version: "1.2.147" };
const LAB = { pkg: "@lucide/lab", version: "0.7.0" };
const JSDELIVR_DATA = "https://data.jsdelivr.com/v1/packages";
/** Downloads ao mesmo tempo, já que o Lab tem um SVG por ícone. */
const PARALLEL_DOWNLOADS = 8;
const LAB_ICON = /^\/icons\/(?<name>[a-z0-9-]+)\.svg$/u;
const SVG_BODY = /<svg[^>]*>(?<body>[\s\S]*)<\/svg>/u;
const BETWEEN_TAGS = />\s+</gu;

/** As chaves do mapa de ícones do Obsidian: `angry:[[1,12,12,10],…]`. */
const MAP_ANCHOR = "angry:[[1,12,12,10]";
const MAP_BEFORE = 400_000;
const MAP_AFTER = 800_000;
const KEY_PATTERN =
  /[,{](?:(?<plain>[a-zA-Z0-9]+)|"(?<quoted>[a-z0-9-]+)"):\[\[\d+,/gu;

/**
 * Atributos que o iconify repete em cada elemento. No plugin eles ficam no
 * <svg>, como no setIcon do Obsidian, para o traço seguir o CSS (stroke-width).
 */
const SHARED_ATTRIBUTES =
  ' fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"';

const defaultAsar = (): string => {
  const local = process.env.LOCALAPPDATA;
  const candidates = [
    local
      ? path.join(local, "Programs", "Obsidian", "resources", "obsidian.asar")
      : "",
    "/Applications/Obsidian.app/Contents/Resources/obsidian.asar",
    "/opt/Obsidian/resources/obsidian.asar",
  ];
  const found = candidates.find((file) => file && existsSync(file));
  if (!found) {
    throw new Error("Informe o caminho do obsidian.asar como argumento.");
  }
  return found;
};

const obsidianIcons = (asar: string): Set<string> => {
  const text = readFileSync(asar).toString("latin1");
  const anchor = text.indexOf(MAP_ANCHOR);
  if (anchor === -1) {
    throw new Error("Mapa de ícones não achado: o formato do Obsidian mudou.");
  }
  const window = text.slice(anchor - MAP_BEFORE, anchor + MAP_AFTER);
  const names = new Set<string>();
  for (const match of window.matchAll(KEY_PATTERN)) {
    names.add(match.groups?.plain ?? match.groups?.quoted ?? "");
  }
  return names;
};

interface IconifyLucide {
  icons: Record<string, { body: string }>;
  aliases?: Record<string, { parent: string }>;
}

const asar = process.argv[2] ?? defaultAsar();
const have = obsidianIcons(asar);

const url = `https://cdn.jsdelivr.net/npm/${ICONIFY.pkg}@${ICONIFY.version}/icons.json`;
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`${url}: ${response.status}`);
}
const lucide = (await response.json()) as IconifyLucide;

// Nomes novos cujo alias (o nome antigo) o Obsidian já traz: é o mesmo desenho.
const coveredByAlias = new Set(
  Object.entries(lucide.aliases ?? {})
    .filter(([alias]) => have.has(alias))
    .map(([, { parent }]) => parent)
);

const normalize = (body: string): string =>
  body.replaceAll(SHARED_ATTRIBUTES, "");

const listed = new Set(
  Object.keys(
    (
      JSON.parse(
        readFileSync(
          path.join(import.meta.dir, "..", "src", "lucide-data.json"),
          "utf-8"
        )
      ) as { icons: Record<string, unknown> }
    ).icons
  )
);

const extra: Record<string, string> = {};
for (const name of Object.keys(lucide.icons).toSorted()) {
  if (have.has(name) || coveredByAlias.has(name) || !listed.has(name)) {
    continue;
  }
  extra[name] = normalize(lucide.icons[name]?.body ?? "");
}

const fetchText = async (address: string): Promise<string> => {
  const reply = await fetch(address);
  if (!reply.ok) {
    throw new Error(`${address}: ${reply.status}`);
  }
  return await reply.text();
};

/** O miolo do SVG oficial: sem o <svg> em volta, os comentários e a quebra entre as tags. */
const labBody = (svg: string): string =>
  (SVG_BODY.exec(svg)?.groups?.body ?? "")
    .replaceAll(BETWEEN_TAGS, "><")
    .trim();

// Lucide Lab: ícones da comunidade, um SVG por ícone. Se o nome já é de um
// ícone do Lucide (ou do Obsidian), vale o do Lucide.
const labRoot = `${LAB.pkg}@${LAB.version}`;
const listing = JSON.parse(
  await fetchText(`${JSDELIVR_DATA}/npm/${labRoot}?structure=flat`)
) as { files: { name: string }[] };
const labNames = listing.files
  .map((file) => LAB_ICON.exec(file.name)?.groups?.name)
  .filter((name): name is string => name !== undefined)
  .filter(
    (name) =>
      !(
        name in lucide.icons ||
        name in (lucide.aliases ?? {}) ||
        have.has(name) ||
        name in extra
      )
  )
  .toSorted();

let next = 0;
const worker = async (): Promise<void> => {
  while (next < labNames.length) {
    const name = labNames[next] ?? "";
    next += 1;
    // oxlint-disable-next-line no-await-in-loop
    const text = await fetchText(
      `https://cdn.jsdelivr.net/npm/${labRoot}/icons/${name}.svg`
    );
    extra[name] = labBody(text);
  }
};
await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
const labCount = labNames.length;

// Ordem estável no arquivo, mesmo com os downloads em paralelo.
const sorted = Object.fromEntries(
  Object.entries(extra).toSorted(([a], [b]) => a.localeCompare(b))
);

const leftover = Object.values(sorted).filter((body) =>
  body.includes('stroke="currentColor"')
).length;
const out = path.join(import.meta.dir, "..", "src", "lucide-extra.json");
writeFileSync(out, `${JSON.stringify(sorted)}\n`);
const kilobytes = Math.round(JSON.stringify(sorted).length / 1024);
const warning =
  leftover > 0 ? ` (${leftover} com atributos próprios, conferir)` : "";
console.log(
  `${Object.keys(sorted).length} ícones, ${kilobytes} KB em ${out} (${labCount} do Lab)${warning}`
);
