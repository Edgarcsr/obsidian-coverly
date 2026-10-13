import type { App } from "obsidian";
import { Modal, Notice } from "obsidian";

import type MdPlusPlugin from "./main";
import { GRADIENTS } from "./note-data";
import type { CreditInfo } from "./note-data";
import { searchUnsplash, trackUnsplashDownload } from "./unsplash";
import type { UnsplashPhoto } from "./unsplash";

type Tab = "gallery" | "unsplash" | "upload" | "link";

interface TabInfo {
  id: Tab;
  label: string;
}

const TABS: TabInfo[] = [
  { id: "gallery", label: "Galeria" },
  { id: "unsplash", label: "Unsplash" },
  { id: "upload", label: "Upload" },
  { id: "link", label: "Link" },
];

const URL_PATTERN = /^https?:\/\//u;

export type CoverPick = (value: string, credit?: CreditInfo) => Promise<void>;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Erro desconhecido.";

/** Mostra um aviso e devolve a notificação, sem efeito colateral solto no chamador. */
const notify = (message: string): Notice => new Notice(message);

export class CoverModal extends Modal {
  private tab: Tab = "gallery";
  private readonly plugin: MdPlusPlugin;
  private readonly sourcePath: string;
  private readonly onPick: CoverPick;

  constructor(
    app: App,
    plugin: MdPlusPlugin,
    sourcePath: string,
    onPick: CoverPick
  ) {
    super(app);
    this.plugin = plugin;
    this.sourcePath = sourcePath;
    this.onPick = onPick;
  }

  onOpen(): void {
    this.modalEl.addClass("mdp-cover-modal");
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const tabs = contentEl.createDiv({ cls: "mdp-tabs" });
    for (const tab of TABS) {
      const button = tabs.createEl("button", {
        cls: tab.id === this.tab ? "mdp-tab is-active" : "mdp-tab",
        text: tab.label,
      });
      button.addEventListener("click", () => {
        this.tab = tab.id;
        this.render();
      });
    }

    const body = contentEl.createDiv({ cls: "mdp-tab-body" });
    switch (this.tab) {
      case "gallery": {
        this.renderGallery(body);
        break;
      }
      case "unsplash": {
        this.renderUnsplash(body);
        break;
      }
      case "upload": {
        this.renderUpload(body);
        break;
      }
      case "link": {
        this.renderLink(body);
        break;
      }
      default: {
        break;
      }
    }
  }

  private renderGallery(body: HTMLElement): void {
    const grid = body.createDiv({ cls: "mdp-gradient-grid" });
    for (const gradient of GRADIENTS) {
      const tile = grid.createEl("button", {
        attr: { "aria-label": gradient.name, title: gradient.name },
        cls: "mdp-gradient-tile",
      });
      tile.style.background = gradient.css;
      tile.addEventListener("click", async () => {
        await this.pick(`gradient:${gradient.id}`);
      });
    }
  }

  private renderUnsplash(body: HTMLElement): void {
    const accessKey = this.plugin.settings.unsplashKey;
    if (!accessKey) {
      body.createDiv({
        cls: "mdp-hint",
        text: "Cole sua Access Key do Unsplash nas configurações do plugin para buscar fotos.",
      });
      return;
    }

    const search = body.createDiv({ cls: "mdp-search" });
    const input = search.createEl("input", {
      placeholder: "Buscar fotos, ex.: montanhas",
      type: "text",
    });
    const grid = body.createDiv({ cls: "mdp-photo-grid" });

    const run = async (): Promise<void> => {
      const query = input.value.trim();
      if (!query) {
        return;
      }
      grid.empty();
      grid.createDiv({ cls: "mdp-hint", text: "Buscando…" });
      try {
        const photos = await searchUnsplash(accessKey, query);
        grid.empty();
        if (photos.length === 0) {
          grid.createDiv({ cls: "mdp-hint", text: "Nenhuma foto encontrada." });
          return;
        }
        for (const photo of photos) {
          this.renderPhoto(grid, photo, accessKey);
        }
      } catch (error) {
        grid.empty();
        grid.createDiv({ cls: "mdp-hint is-error", text: errorMessage(error) });
      }
    };

    input.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        await run();
      }
    });
    search
      .createEl("button", { cls: "mdp-btn", text: "Buscar" })
      .addEventListener("click", async () => {
        await run();
      });
    input.focus();
  }

  private renderPhoto(
    grid: HTMLElement,
    photo: UnsplashPhoto,
    accessKey: string
  ): void {
    const card = grid.createEl("button", { cls: "mdp-photo" });
    card.createEl("img", {
      attr: { alt: photo.alt, loading: "lazy", src: photo.thumb },
    });
    card.createSpan({ cls: "mdp-photo-credit", text: photo.photographer.name });
    card.addEventListener("click", async () => {
      // O aviso de download é obrigatório pela API, mas não deve bloquear a capa.
      await trackUnsplashDownload(accessKey, photo.downloadLocation).catch(
        () => false
      );
      await this.pick(photo.regular, photo.photographer);
    });
  }

  private renderUpload(body: HTMLElement): void {
    const zone = body.createDiv({ cls: "mdp-dropzone" });
    zone.createDiv({
      cls: "mdp-dropzone-title",
      text: "Arraste uma imagem aqui",
    });
    zone.createDiv({
      cls: "mdp-hint",
      text: "ou clique para escolher. Fica salva na pasta de anexos do vault.",
    });
    const input = zone.createEl("input", {
      attr: { accept: "image/*" },
      type: "file",
    });
    input.hide();

    zone.addEventListener("click", () => {
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
      const path = await this.app.fileManager.getAvailablePathForAttachment(
        file.name,
        this.sourcePath
      );
      const created = await this.app.vault.createBinary(
        path,
        await file.arrayBuffer()
      );
      await this.pick(created.path);
    } catch (error) {
      notify(`Não foi possível salvar a imagem: ${errorMessage(error)}`);
    }
  }

  private renderLink(body: HTMLElement): void {
    const form = body.createDiv({ cls: "mdp-search" });
    const input = form.createEl("input", {
      placeholder: "Cole o endereço de uma imagem",
      type: "url",
    });
    const preview = body.createDiv({ cls: "mdp-link-preview" });
    const confirm = body.createEl("button", {
      cls: "mdp-btn is-primary",
      text: "Usar esta capa",
    });
    confirm.disabled = true;

    input.addEventListener("input", () => {
      const url = input.value.trim();
      preview.empty();
      confirm.disabled = !URL_PATTERN.test(url);
      if (confirm.disabled) {
        return;
      }
      preview.createEl("img", { attr: { alt: "Pré-visualização", src: url } });
    });
    confirm.addEventListener("click", async () => {
      await this.pick(input.value.trim());
    });
    input.focus();
  }

  private async pick(value: string, credit?: CreditInfo): Promise<void> {
    await this.onPick(value, credit);
    this.close();
  }
}
