/**
 * Gera src/lucide-data.json com as tags e as categorias de cada ícone
 * Lucide, as mesmas que o lucide.dev usa na busca ("money" acha "banknote").
 * Os ícones em si já vêm no Obsidian; aqui só entram os metadados. Os do
 * Lucide Lab (ícones da comunidade, ver build-lucide-extra.ts) entram com as
 * tags e categorias do repositório deles no GitHub, porque o lucide.dev não
 * as publica na API.
 *
 * Uso: bun scripts/build-lucide.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

const API = "https://lucide.dev/api";

const fetchJson = async (url: string): Promise<Record<string, string[]>> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return (await response.json()) as Record<string, string[]>;
};

const [tags, categories] = await Promise.all([
  fetchJson(`${API}/tags`),
  fetchJson(`${API}/categories`),
]);

const LAB = { pkg: "@lucide/lab", version: "0.7.0" };
const JSDELIVR_DATA = "https://data.jsdelivr.com/v1/packages";
const LAB_RAW =
  "https://raw.githubusercontent.com/lucide-icons/lucide-lab/main/icons";
const LAB_ICON = /^\/icons\/(?<name>[a-z0-9-]+)\.svg$/u;
const PARALLEL_DOWNLOADS = 8;

interface LabMetadata {
  tags?: string[];
  categories?: string[];
}

/** Nomes do pacote oficial do Lab, na versão de onde saem os desenhos. */
const labNames = async (): Promise<string[]> => {
  const reply = await fetch(
    `${JSDELIVR_DATA}/npm/${LAB.pkg}@${LAB.version}?structure=flat`
  );
  if (!reply.ok) {
    throw new Error(`${LAB.pkg}: ${reply.status}`);
  }
  const listing = (await reply.json()) as { files: { name: string }[] };
  return listing.files
    .map((file) => LAB_ICON.exec(file.name)?.groups?.name)
    .filter((name): name is string => name !== undefined)
    .toSorted();
};

const LAB_PAGE = "https://lucide.dev/icons/lab";
const PAGE_TAGS = /Tagged as: (?<tags>[^"]*)\.">/u;

/**
 * Tags lidas da página do ícone no lucide.dev, para os ícones que o pacote
 * oficial já tem e o repositório do GitHub ainda não (o `bat`, por exemplo).
 * Estão na descrição da página. As categorias ficam de fora: a página lista
 * todas no menu, então não dá para saber quais são do ícone.
 */
const labPageMetadata = async (name: string): Promise<LabMetadata> => {
  const reply = await fetch(`${LAB_PAGE}/${name}`);
  if (!reply.ok) {
    return {};
  }
  const html = await reply.text();
  const found = PAGE_TAGS.exec(html)?.groups?.tags ?? "";
  return {
    tags: found
      .split(", ")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
};

/** Do repositório do GitHub e, se ele não tem o ícone, da página do lucide.dev. */
const labEntry = async (name: string): Promise<LabMetadata> => {
  const reply = await fetch(`${LAB_RAW}/${name}.json`);
  return reply.ok
    ? ((await reply.json()) as LabMetadata)
    : await labPageMetadata(name);
};

/**
 * Tags e categorias de cada ícone do Lab. Todo ícone ganha uma entrada, com ou
 * sem tags, para a busca por nome achar os que não têm nenhuma.
 */
const labMetadata = async (
  names: string[]
): Promise<Record<string, LabMetadata>> => {
  const found: Record<string, LabMetadata> = {};
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < names.length) {
      const name = names[next] ?? "";
      next += 1;
      // oxlint-disable-next-line no-await-in-loop
      found[name] = await labEntry(name);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
  return found;
};

const lab = await labMetadata(await labNames());
const labCategories = Object.values(lab).flatMap(
  (entry) => entry.categories ?? []
);

// As categorias do Lucide primeiro, em ordem; as só do Lab entram no fim, para
// os índices já gravados não mudarem.
const lucideCategoryIds = [
  ...new Set(Object.values(categories).flat()),
].toSorted();
const categoryIds = [
  ...lucideCategoryIds,
  ...[...new Set(labCategories)]
    .filter((id) => !lucideCategoryIds.includes(id))
    .toSorted(),
];
const index = new Map(categoryIds.map((id, i) => [id, i]));

// Por ícone: as tags num texto só e os índices das categorias.
const icons: Record<string, [string, number[]]> = {};
for (const name of Object.keys(tags).toSorted()) {
  icons[name] = [
    (tags[name] ?? []).join(" "),
    (categories[name] ?? []).map((id) => index.get(id) ?? -1),
  ];
}

// Ícone do Lab com o mesmo nome de um do Lucide: vale o do Lucide.
let labCount = 0;
for (const name of Object.keys(lab).toSorted()) {
  if (name in icons) {
    continue;
  }
  const entry = lab[name];
  icons[name] = [
    (entry?.tags ?? []).join(" "),
    (entry?.categories ?? []).map((id) => index.get(id) ?? -1),
  ];
  labCount += 1;
}

const out = path.join(import.meta.dir, "..", "src", "lucide-data.json");
writeFileSync(out, `${JSON.stringify({ categories: categoryIds, icons })}\n`);
console.log(
  `${Object.keys(icons).length} ícones (${labCount} do Lab), ${categoryIds.length} categorias em ${out}`
);
