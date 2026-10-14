/**
 * Gera src/lucide-data.json com as tags e as categorias de cada ícone
 * Lucide, as mesmas que o lucide.dev usa na busca ("money" acha "banknote").
 * Os ícones em si já vêm no Obsidian; aqui só entram os metadados.
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

const categoryIds = [...new Set(Object.values(categories).flat())].toSorted();
const index = new Map(categoryIds.map((id, i) => [id, i]));

// Por ícone: as tags num texto só e os índices das categorias.
const icons: Record<string, [string, number[]]> = {};
for (const name of Object.keys(tags).toSorted()) {
  icons[name] = [
    (tags[name] ?? []).join(" "),
    (categories[name] ?? []).map((id) => index.get(id) ?? -1),
  ];
}

const out = path.join(import.meta.dir, "..", "src", "lucide-data.json");
writeFileSync(out, `${JSON.stringify({ categories: categoryIds, icons })}\n`);
console.log(
  `${Object.keys(icons).length} ícones, ${categoryIds.length} categorias em ${out}`
);
