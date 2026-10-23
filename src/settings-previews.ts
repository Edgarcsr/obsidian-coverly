import type { Setting } from "obsidian";

import { asyncListener } from "./async-listener";
import { coverThumbUrl } from "./cover-thumbs";
import { paintCover } from "./header";
import type CoverlyPlugin from "./main";
import { drawPageIcon } from "./page-icon";
import { sampleNotes } from "./settings-samples";
import type { Sample } from "./settings-samples";

/**
 * Prévias das configurações. Mostram o que cada opção muda com o conteúdo do
 * próprio vault (nome, ícone e capa de notas de verdade, ver
 * settings-samples.ts) e com o código que o plugin usa para desenhar: a capa
 * vem de `paintCover`, o ícone de `drawPageIcon` e a lista do explorador usa
 * as mesmas classes e o mesmo CSS do explorador. Sem esse conteúdo no vault,
 * entram exemplos neutros e chapados.
 */

/** Uma opção de um grupo de cartões: o valor, o nome e o desenho. */
export interface Choice {
  value: string;
  label: string;
  draw: (mock: HTMLElement) => void;
}

const FALLBACK_ICON = "lucide:book-open";

const mockBox = (parent: HTMLElement): HTMLElement =>
  parent.createDiv({ cls: "mdp-mock" });

/** O ícone de uma nota, desenhado como o plugin o desenha. */
const iconCell = (
  plugin: CoverlyPlugin,
  parent: HTMLElement,
  value: string | undefined,
  cls: string
): HTMLElement => {
  const cell = parent.createDiv({ cls });
  drawPageIcon(
    plugin.app,
    cell,
    value ?? FALLBACK_ICON,
    plugin.settings.twemoji
  );
  return cell;
};

/** Faixa no topo da linha, ocupando a largura toda, com a prévia no meio. */
const previewSlot = (setting: Setting): HTMLElement => {
  setting.settingEl.addClass("mdp-preview-row");
  return setting.settingEl.createDiv({ cls: "mdp-preview" });
};

/**
 * Dropdown de sempre à direita e, no topo da linha e centralizada, uma prévia
 * da opção escolhida, que troca na hora ao mudar a escolha.
 */
export const renderChoice = (
  setting: Setting,
  choices: readonly Choice[],
  current: string,
  onPick: (value: string) => Promise<void>
): void => {
  const preview = previewSlot(setting);
  const show = (value: string): void => {
    preview.empty();
    choices.find((choice) => choice.value === value)?.draw(mockBox(preview));
  };
  show(current);
  setting.addDropdown((dropdown) => {
    for (const choice of choices) {
      dropdown.addOption(choice.value, choice.label);
    }
    dropdown.setValue(current).onChange(
      asyncListener(async (value: string) => {
        show(value);
        await onPick(value);
      })
    );
  });
};

/** Faixa da capa da nota de exemplo: a foto ou a cor dela, ou um bloco neutro. */
const drawCover = (
  plugin: CoverlyPlugin,
  parent: HTMLElement,
  hero: Sample
): HTMLElement => {
  const cover = parent.createDiv({ cls: "mdp-mock-cover" });
  if (hero.data.cover) {
    paintCover(
      plugin.app,
      cover.createDiv({ cls: "mdp-mock-cover-image" }),
      hero.data,
      undefined,
      true
    );
  }
  return cover;
};

/** Ícone no cabeçalho: grande sobre a borda da capa, ou pequeno na linha do título. */
export const drawIconPosition =
  (plugin: CoverlyPlugin, position: "above" | "inline") =>
  (mock: HTMLElement): void => {
    const { hero } = sampleNotes(plugin);
    drawCover(plugin, mock, hero);
    if (position === "above") {
      iconCell(plugin, mock, hero.data.icon, "mdp-mock-icon is-large");
      mock.createDiv({ cls: "mdp-mock-title", text: hero.name });
      return;
    }
    const row = mock.createDiv({ cls: "mdp-mock-heading" });
    iconCell(plugin, row, hero.data.icon, "mdp-mock-icon");
    row.createDiv({ cls: "mdp-mock-title", text: hero.name });
  };

/** Uma linha do explorador, com as classes que o Obsidian e o plugin usam. */
const treeRow = (
  plugin: CoverlyPlugin,
  tree: HTMLElement,
  name: string,
  icon?: string
): HTMLElement => {
  const title = tree
    .createDiv({ cls: "tree-item nav-file" })
    .createDiv({ cls: "tree-item-self nav-file-title" });
  const content = title.createDiv({
    cls: "tree-item-inner nav-file-title-content",
    text: name,
  });
  if (icon) {
    const cell = createSpan({ cls: "mdp-inline-icon" });
    drawPageIcon(plugin.app, cell, icon, plugin.settings.twemoji);
    content.before(cell);
  }
  return title;
};

const treeMock = (mock: HTMLElement, inline: boolean): HTMLElement => {
  const tree = mock.createDiv({ cls: "nav-files-container mdp-mock-tree" });
  tree.toggleClass("mdp-tree-icon-inline", inline);
  return tree;
};

/** Ícones no explorador: no recuo, alinhando os nomes, ou no começo, empurrando o texto. */
export const drawTreeIconPosition =
  (plugin: CoverlyPlugin, position: "indent" | "inline") =>
  (mock: HTMLElement): void => {
    const { iconed, plain } = sampleNotes(plugin);
    const tree = treeMock(mock, position === "inline");
    const [first, second] = iconed;
    treeRow(plugin, tree, first?.name ?? "", first?.data.icon);
    treeRow(plugin, tree, plain[0]?.name ?? "");
    treeRow(plugin, tree, second?.name ?? "", second?.data.icon);
  };

/**
 * Miniatura para o fundo de um item: a pronta (como no explorador), ou a
 * própria imagem do vault enquanto a miniatura não existe.
 */
const backgroundLayer = (
  plugin: CoverlyPlugin,
  source: string | undefined
): string | null => {
  if (!source) {
    return null;
  }
  const url =
    coverThumbUrl(source) ??
    (() => {
      const file = plugin.app.vault.getFileByPath(source);
      return file ? plugin.app.vault.getResourcePath(file) : null;
    })();
  return url ? `url("${url.replaceAll('"', "%22")}")` : null;
};

/** Quais itens do explorador ganham a miniatura da capa como fundo. */
export const drawTreeBackgrounds =
  (plugin: CoverlyPlugin, mode: "both" | "images" | "notes" | "off") =>
  (mock: HTMLElement): void => {
    const { image, photo, plain } = sampleNotes(plugin);
    const tree = treeMock(mock, false);
    const rows: [HTMLElement, string | undefined, boolean][] = [
      [
        treeRow(plugin, tree, image?.name ?? "image.png", "lucide:image"),
        image?.path,
        mode === "images" || mode === "both",
      ],
      [
        treeRow(
          plugin,
          tree,
          photo?.name ?? plain[0]?.name ?? "",
          photo?.data.icon ?? "lucide:file-text"
        ),
        photo?.data.cover,
        mode === "notes" || mode === "both",
      ],
      [treeRow(plugin, tree, plain[0]?.name ?? ""), undefined, false],
    ];
    for (const [title, source, applies] of rows) {
      if (!applies) {
        continue;
      }
      const layer = backgroundLayer(plugin, source);
      if (layer) {
        title.style.setProperty("--mdp-tree-cover", layer);
        title.addClass("mdp-tree-cover");
      } else {
        // Sem imagem no vault: um bloco chapado marca onde o fundo entraria.
        title.addClass("mdp-mock-tint");
      }
    }
  };

/**
 * Prévia da capa, ao vivo: é a capa de verdade (`.mdp-cover`), em escala menor,
 * e lê as mesmas variáveis CSS que o plugin põe no `body` (altura, cantos,
 * degradê e sombra), então muda sozinha quando um controle é movido.
 */
export const renderCoverPreview = (
  setting: Setting,
  plugin: CoverlyPlugin
): void => {
  const { hero } = sampleNotes(plugin);
  const mock = mockBox(previewSlot(setting));
  mock.addClass("is-cover-preview");
  const cover = mock.createDiv({ cls: "mdp-cover" });
  const surface = cover.createDiv({ cls: "mdp-cover-image" });
  if (hero.data.cover) {
    paintCover(plugin.app, surface, hero.data, undefined, true);
  }
  iconCell(plugin, mock, hero.data.icon, "mdp-mock-icon is-large");
  mock.createDiv({ cls: "mdp-mock-title", text: hero.name });
};
