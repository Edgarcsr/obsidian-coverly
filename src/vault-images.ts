import { setTooltip } from "obsidian";
import type { App, TFile } from "obsidian";

import { asyncListener } from "./async-listener";
import { t } from "./i18n";
import { trimIconImage } from "./icon-trim";
import { searchField } from "./popover";

const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  "avif",
  "bmp",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

/** Miniaturas desenhadas por vez; o resto entra em "Mostrar mais". */
const PAGE_SIZE = 60;

export interface VaultImagesContext {
  app: App;
  /** Imagem atual da nota, para marcar a selecionada. */
  current: string | undefined;
  pick: (path: string) => Promise<void>;
  /** Ladrilhos 1:1 (ícones) em vez dos retangulares das capas. */
  square?: boolean;
}

/** Arquivo de imagem que dá para mostrar (e usar como capa ou ícone). */
export const isImageFile = (file: TFile): boolean =>
  IMAGE_EXTENSIONS.has(file.extension.toLowerCase());

/** Imagens do vault, as mais recentes primeiro. */
export const vaultImages = (app: App): TFile[] =>
  app.vault
    .getFiles()
    .filter(isImageFile)
    .toSorted((a, b) => b.stat.mtime - a.stat.mtime);

/** Aba "Vault": busca por nome e grade de miniaturas das imagens do próprio vault. */
export const renderVaultImages = (
  body: HTMLElement,
  context: VaultImagesContext
): void => {
  const { app } = context;
  const images = vaultImages(app);

  const search = body.createDiv({ cls: "mdp-picker-search" });
  const input = searchField(search, t("vault.placeholder"));
  // Os mesmos ladrilhos da galeria; o nome vai na dica.
  const grid = body.createDiv({
    cls: context.square
      ? "mdp-picker-grid is-framed is-square"
      : "mdp-picker-grid is-framed",
  });
  const status = body.createDiv({ cls: "mdp-picker-hint is-empty" });
  const more = body.createEl("button", {
    cls: "mdp-picker-ghost",
    text: t("vault.more"),
  });

  let matches: TFile[] = images;
  let shown = 0;

  const addCard = (file: TFile): void => {
    const card = grid.createEl("button", {
      attr: { "aria-label": file.path },
      cls:
        file.path === context.current
          ? "mdp-picker-tile is-selected"
          : "mdp-picker-tile",
    });
    const img = card.createEl("img", {
      attr: {
        alt: file.name,
        loading: "lazy",
        src: app.vault.getResourcePath(file),
      },
    });
    if (context.square) {
      trimIconImage(img, {
        path: file.path,
        read: () => app.vault.readBinary(file),
      });
    }
    setTooltip(card, file.path);
    card.addEventListener(
      "click",
      asyncListener(async () => {
        await context.pick(file.path);
      })
    );
  };

  const showNext = (): void => {
    for (const file of matches.slice(shown, shown + PAGE_SIZE)) {
      addCard(file);
    }
    shown = Math.min(matches.length, shown + PAGE_SIZE);
    more.toggle(shown < matches.length);
  };

  const refresh = (): void => {
    const query = input.value.trim().toLowerCase();
    matches = query
      ? images.filter((file) => file.path.toLowerCase().includes(query))
      : images;
    grid.empty();
    shown = 0;
    status.setText(matches.length === 0 ? t("vault.empty") : "");
    status.toggle(matches.length === 0);
    showNext();
  };

  input.addEventListener("input", refresh);
  more.addEventListener("click", showNext);
  refresh();
  input.focus();
};
