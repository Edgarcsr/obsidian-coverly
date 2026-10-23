import { requestUrl } from "obsidian";

/**
 * Pacotes de ícones que podem ser instalados nas configurações, além do
 * Lucide, que já vem com o Obsidian. Nenhum vai no main.js: cada um é baixado
 * do jsDelivr quando a pessoa pede e guardado no vault (ver icon-packs.ts).
 *
 * Os ids e as versões ficam gravados nos ícones e nos arquivos: nunca mude o
 * id de um pacote, e ao trocar a versão confira que os nomes continuam.
 */

const JSDELIVR = "https://cdn.jsdelivr.net";
const JSDELIVR_DATA = "https://data.jsdelivr.com/v1/packages";
/** Downloads ao mesmo tempo, para os pacotes de um SVG por arquivo. */
const PARALLEL_DOWNLOADS = 8;
const SVG_EXTENSION = /\.svg$/u;

/** Um conjunto do Iconify: um único icons.json com todos os desenhos. */
interface IconifySource {
  kind: "iconify";
  pkg: string;
  version: string;
  /** Deixa de fora os nomes que batem, como os outros pesos do Phosphor. */
  exclude?: RegExp;
}

/** Um repositório do GitHub com um SVG por ícone, em algumas pastas. */
interface GithubSource {
  kind: "github";
  repo: string;
  version: string;
  dirs: string[];
}

export interface IconPackInfo {
  id: string;
  name: string;
  license: string;
  homepage: string;
  /** Desenho de uma cor só (`currentColor`): leva a cor escolhida, como o Lucide. */
  tintable: boolean;
  /** Tamanho aproximado depois de instalado, para mostrar antes de baixar. */
  approxBytes: number;
  source: IconifySource | GithubSource;
}

export const ICON_PACKS: readonly IconPackInfo[] = [
  {
    approxBytes: 1_400_000,
    homepage: "https://github.com/miguelsolorio/vscode-symbols",
    id: "symbols",
    license: "MIT",
    name: "Symbols",
    source: {
      dirs: ["src/icons/folders", "src/icons/files"],
      kind: "github",
      repo: "miguelsolorio/vscode-symbols",
      version: "0.0.26",
    },
    tintable: false,
  },
  {
    approxBytes: 2_100_000,
    homepage: "https://tabler.io/icons",
    id: "tabler",
    license: "MIT",
    name: "Tabler",
    source: { kind: "iconify", pkg: "@iconify-json/tabler", version: "1.2.42" },
    tintable: true,
  },
  {
    approxBytes: 800_000,
    homepage: "https://phosphoricons.com",
    id: "phosphor",
    license: "MIT",
    name: "Phosphor",
    source: {
      exclude: /-(?:bold|duotone|fill|light|thin)$/u,
      kind: "iconify",
      pkg: "@iconify-json/ph",
      version: "1.2.2",
    },
    tintable: true,
  },
];

export const packInfo = (id: string): IconPackInfo | undefined =>
  ICON_PACKS.find((pack) => pack.id === id);

/** Um ícone baixado: o nome e o SVG inteiro. */
export type PackIconSource = [name: string, svg: string];

interface IconifyIcon {
  body: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

interface IconifyJson {
  icons: Record<string, IconifyIcon>;
  width?: number;
  height?: number;
}

/** Lado padrão dos desenhos do Iconify quando o conjunto não diz. */
const ICONIFY_DEFAULT_SIZE = 16;

const downloadIconify = async (
  source: IconifySource
): Promise<PackIconSource[]> => {
  const url = `${JSDELIVR}/npm/${source.pkg}@${source.version}/icons.json`;
  const response = await requestUrl(url);
  const data = response.json as IconifyJson;
  const width = data.width ?? ICONIFY_DEFAULT_SIZE;
  const height = data.height ?? ICONIFY_DEFAULT_SIZE;
  return Object.entries(data.icons)
    .filter(([name]) => !source.exclude?.test(name))
    .map(([name, icon]): PackIconSource => {
      const box = [
        icon.left ?? 0,
        icon.top ?? 0,
        icon.width ?? width,
        icon.height ?? height,
      ].join(" ");
      return [
        name,
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${icon.body}</svg>`,
      ];
    });
};

interface JsdelivrListing {
  files: { name: string }[];
}

/** Baixa as URLs em lotes de poucos por vez, contando o progresso. */
const downloadAll = async (
  urls: string[],
  onProgress: (done: number, total: number) => void
): Promise<string[]> => {
  const results: string[] = Array.from({ length: urls.length }, () => "");
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (next < urls.length) {
      const index = next;
      next += 1;
      // oxlint-disable-next-line no-await-in-loop
      const response = await requestUrl(urls[index] ?? "");
      results[index] = response.text;
      done += 1;
      onProgress(done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
  return results;
};

const downloadGithub = async (
  source: GithubSource,
  onProgress: (done: number, total: number) => void
): Promise<PackIconSource[]> => {
  const root = `gh/${source.repo}@${source.version}`;
  const response = await requestUrl(`${JSDELIVR_DATA}/${root}?structure=flat`);
  const listing = response.json as JsdelivrListing;
  // Na ordem das pastas da lista (as de pasta antes das de arquivo).
  const paths = source.dirs.flatMap((dir) =>
    listing.files
      .map((file) => file.name)
      .filter(
        (name) =>
          name.startsWith(`/${dir}/`) &&
          !name.slice(dir.length + 2).includes("/") &&
          SVG_EXTENSION.test(name)
      )
      .toSorted()
  );
  const svgs = await downloadAll(
    paths.map((name) => `${JSDELIVR}/${root}${name}`),
    onProgress
  );
  const seen = new Set<string>();
  const icons: PackIconSource[] = [];
  for (const [index, name] of paths.entries()) {
    const id = (name.split("/").pop() ?? "").replace(SVG_EXTENSION, "");
    if (!seen.has(id)) {
      seen.add(id);
      icons.push([id, svgs[index] ?? ""]);
    }
  }
  return icons;
};

/** Baixa todos os ícones do pacote. */
export const downloadPack = async (
  pack: IconPackInfo,
  onProgress: (done: number, total: number) => void
): Promise<PackIconSource[]> =>
  pack.source.kind === "iconify"
    ? await downloadIconify(pack.source)
    : await downloadGithub(pack.source, onProgress);
