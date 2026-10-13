import { Notice } from "obsidian";

import { firstImage, saveImageAttachment } from "./attachments";
import { GALLERY } from "./gallery";
import type MdPlusPlugin from "./main";
import type { CreditInfo } from "./note-data";
import { TabbedPopover, searchField } from "./popover";
import type { PopoverTab } from "./popover";
import { searchUnsplash, trackUnsplashDownload } from "./unsplash";
import type { UnsplashPhoto } from "./unsplash";

type Tab = "gallery" | "upload" | "link" | "unsplash";

/** Símbolo oficial do Unsplash, como o Notion mostra na aba. */
const UNSPLASH_LOGO = "M10 9V0h12v9H10zm12 5h10v18H0V14h10v9h12v-9z";

const TABS: PopoverTab<Tab>[] = [
  { id: "gallery", label: "Galeria" },
  { id: "upload", label: "Carregar" },
  { id: "link", label: "Link" },
  { icon: UNSPLASH_LOGO, id: "unsplash", label: "Unsplash" },
];

const URL_PATTERN = /^https?:\/\//u;

export type CoverPick = (value: string, credit?: CreditInfo) => Promise<void>;

export interface CoverPickerOptions {
  plugin: MdPlusPlugin;
  sourcePath: string;
  /** Botão que abriu o seletor; sem ele o popover abre centralizado. */
  anchor: HTMLElement | null;
  /** Capa atual da nota, para marcar a selecionada e mostrar "Remover". */
  current: string | undefined;
  onPick: CoverPick;
  onRemove: () => Promise<void>;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Erro desconhecido.";

/** Mostra um aviso e devolve a notificação, sem efeito colateral solto no chamador. */
const notify = (message: string): Notice => new Notice(message);

/**
 * Seletor de capa. Na galeria e no Unsplash continua aberto depois de
 * escolher, para dar para experimentar várias capas seguidas.
 */
export class CoverPicker extends TabbedPopover<Tab> {
  private readonly options: CoverPickerOptions;
  private current: string | undefined;

  /**
   * Ctrl+V com uma imagem na área de transferência vira a capa, em qualquer
   * aba. Texto colado (um link, por exemplo) segue o caminho normal do campo.
   */
  private readonly onPaste = async (event: ClipboardEvent): Promise<void> => {
    const image = firstImage(event.clipboardData?.files);
    if (!image) {
      return;
    }
    event.preventDefault();
    await this.upload(image);
  };

  constructor(options: CoverPickerOptions) {
    super(options.anchor, TABS, "gallery", "mdp-cover-picker");
    this.options = options;
    this.current = options.current;
  }

  override open(): void {
    super.open();
    document.addEventListener("paste", this.onPaste, true);
  }

  override close(): void {
    document.removeEventListener("paste", this.onPaste, true);
    super.close();
  }

  protected hasRemove(): boolean {
    return Boolean(this.current);
  }

  protected async remove(): Promise<void> {
    await this.options.onRemove();
  }

  protected renderTab(tab: Tab): void {
    switch (tab) {
      case "gallery": {
        this.renderGallery();
        break;
      }
      case "upload": {
        this.renderUpload();
        break;
      }
      case "link": {
        this.renderLink();
        break;
      }
      case "unsplash": {
        this.renderUnsplash();
        break;
      }
      default: {
        break;
      }
    }
  }

  private renderGallery(): void {
    for (const section of GALLERY) {
      this.body.createDiv({
        cls: "mdp-picker-section-title",
        text: section.title,
      });
      const grid = this.body.createDiv({ cls: "mdp-picker-grid" });
      for (const item of section.items) {
        const value =
          item.kind === "gradient" ? `gradient:${item.id}` : item.url;
        const tile = grid.createEl("button", {
          attr: { "aria-label": item.name, title: item.name },
          cls:
            value === this.current
              ? "mdp-picker-tile is-selected"
              : "mdp-picker-tile",
        });
        if (item.kind === "gradient") {
          tile.style.backgroundImage = item.css;
        } else {
          // Imagem com carregamento preguiçoso: só baixa ao rolar até ela.
          tile.createEl("img", {
            attr: { alt: item.name, loading: "lazy", src: item.thumb },
          });
        }
        tile.addEventListener("click", async () => {
          await this.choose(
            value,
            item.kind === "artwork" ? item.credit : undefined
          );
          for (const other of this.body.querySelectorAll(".is-selected")) {
            other.removeClass("is-selected");
          }
          tile.addClass("is-selected");
        });
      }
    }
  }

  private renderUpload(): void {
    const zone = this.body.createDiv({ cls: "mdp-picker-upload" });
    const button = zone.createEl("button", {
      cls: "mdp-picker-primary",
      text: "Carregar arquivo",
    });
    zone.createDiv({
      cls: "mdp-picker-hint",
      text: "Arraste uma imagem para cá ou Ctrl+V para colar uma imagem. Imagens com mais de 1500 pixels de largura funcionam melhor.",
    });
    const input = zone.createEl("input", {
      attr: { accept: "image/*" },
      type: "file",
    });
    input.hide();

    button.addEventListener("click", () => {
      input.click();
    });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (file) {
        await this.upload(file);
      }
    });
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.addClass("is-over");
    });
    zone.addEventListener("dragleave", () => {
      zone.removeClass("is-over");
    });
    zone.addEventListener("drop", async (event) => {
      event.preventDefault();
      zone.removeClass("is-over");
      const file = event.dataTransfer?.files[0];
      if (file) {
        await this.upload(file);
      }
    });
  }

  private async upload(file: File): Promise<void> {
    if (!file.type.startsWith("image/")) {
      notify("Escolha um arquivo de imagem.");
      return;
    }
    try {
      const path = await saveImageAttachment(
        this.options.plugin.app,
        file,
        this.options.sourcePath
      );
      await this.choose(path);
      this.close();
    } catch (error) {
      notify(`Não foi possível salvar a imagem: ${errorMessage(error)}`);
    }
  }

  private renderLink(): void {
    const form = this.body.createDiv({ cls: "mdp-picker-link" });
    const input = form.createEl("input", {
      cls: "mdp-picker-input",
      placeholder: "Cole o link da imagem…",
      type: "url",
    });
    const submit = form.createEl("button", {
      cls: "mdp-picker-primary is-accent",
      text: "Enviar",
    });
    form.createDiv({
      cls: "mdp-picker-hint",
      text: "Funciona com qualquer imagem da web.",
    });
    submit.disabled = true;

    const send = async (): Promise<void> => {
      const url = input.value.trim();
      if (!URL_PATTERN.test(url)) {
        return;
      }
      await this.choose(url);
      this.close();
    };

    input.addEventListener("input", () => {
      submit.disabled = !URL_PATTERN.test(input.value.trim());
    });
    input.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        await send();
      }
    });
    submit.addEventListener("click", send);
    input.focus();
  }

  private renderUnsplash(): void {
    const accessKey = this.options.plugin.settings.unsplashKey;
    if (!accessKey) {
      this.body.createDiv({
        cls: "mdp-picker-hint is-empty",
        text: "Cole sua Access Key do Unsplash nas configurações do plugin para buscar fotos.",
      });
      return;
    }

    const search = this.body.createDiv({ cls: "mdp-picker-search" });
    const input = searchField(search, "Pesquise uma imagem e tecle Enter…");
    const grid = this.body.createDiv({ cls: "mdp-picker-photos" });
    const status = this.body.createDiv({
      cls: "mdp-picker-hint is-empty",
      text: "Fotos de alta resolução do Unsplash.",
    });

    const run = async (): Promise<void> => {
      const query = input.value.trim();
      if (!query) {
        return;
      }
      grid.empty();
      status.setText("Buscando…");
      status.show();
      try {
        const photos = await searchUnsplash(accessKey, query);
        if (photos.length === 0) {
          status.setText("Nenhuma foto encontrada.");
          return;
        }
        status.hide();
        for (const photo of photos) {
          this.renderPhoto(grid, photo, accessKey);
        }
      } catch (error) {
        status.setText(errorMessage(error));
      }
    };

    input.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        await run();
      }
    });
    input.focus();
  }

  private renderPhoto(
    grid: HTMLElement,
    photo: UnsplashPhoto,
    accessKey: string
  ): void {
    const card = grid.createEl("button", {
      attr: { "aria-label": `Foto de ${photo.photographer.name}` },
      cls: "mdp-picker-photo",
    });
    card.createEl("img", {
      attr: { alt: photo.alt, loading: "lazy", src: photo.thumb },
    });
    card.createSpan({
      cls: "mdp-picker-photo-credit",
      text: photo.photographer.name,
    });
    card.addEventListener("click", async () => {
      // O aviso de download é obrigatório pela API, mas não deve bloquear a capa.
      await trackUnsplashDownload(accessKey, photo.downloadLocation).catch(
        () => false
      );
      await this.choose(photo.regular, {
        name: `Foto de ${photo.photographer.name} no Unsplash`,
        url: photo.photographer.url,
      });
    });
  }

  /** Aplica a capa e passa a mostrar "Remover", já que agora existe uma. */
  private async choose(value: string, credit?: CreditInfo): Promise<void> {
    await this.options.onPick(value, credit);
    const hadCover = Boolean(this.current);
    this.current = value;
    if (!hadCover) {
      this.renderTabs();
    }
  }
}
