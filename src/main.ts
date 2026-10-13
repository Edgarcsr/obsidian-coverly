import { Notice, Plugin } from "obsidian";
import type { Modal, TFile } from "obsidian";

import { CoverPicker } from "./cover-picker";
import { EmojiModal } from "./emoji-modal";
import { COVER_KEYS, FM, dataFromFrontmatter } from "./note-data";
import type { CreditInfo } from "./note-data";
import { DEFAULT_SETTINGS, MdPlusSettingTab } from "./settings";
import type { MdPlusSettings } from "./settings";
import { HeaderManager } from "./view-header";

type FrontmatterWriter = (fm: Record<string, unknown>) => void;

const COVER_HEIGHT_VAR = "--mdp-cover-height";

/** Abre um modal sem deixar a chamada solta como efeito colateral. */
const openModal = (modal: Modal): void => {
  modal.open();
};

/** Remove chaves do frontmatter. `Reflect` evita o `delete` com chave dinâmica. */
const removeKeys = (
  fm: Record<string, unknown>,
  keys: readonly string[]
): void => {
  for (const key of keys) {
    Reflect.deleteProperty(fm, key);
  }
};

/** Aviso ao usuário. Devolve a notificação para não ser um efeito colateral solto. */
const notify = (message: string): Notice => new Notice(message);

export default class MdPlusPlugin extends Plugin {
  settings: MdPlusSettings = { ...DEFAULT_SETTINGS };
  private readonly headers = new HeaderManager(this);
  /** Só um seletor de capa aberto por vez. */
  private picker: CoverPicker | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.applyCoverHeight();

    this.addSettingTab(new MdPlusSettingTab(this.app, this));
    this.registerHeaderSync();

    this.addCommand({
      callback: () => {
        const path = this.activeNotePath();
        if (path) {
          this.openCoverPicker(path);
        }
      },
      id: "change-cover",
      name: "Alterar capa",
    });
    this.addCommand({
      callback: () => {
        const path = this.activeNotePath();
        if (path) {
          this.openIconPicker(path);
        }
      },
      id: "change-icon",
      name: "Alterar ícone",
    });
    this.addCommand({
      callback: async () => {
        const path = this.activeNotePath();
        if (path) {
          await this.setCover(path, null);
        }
      },
      id: "remove-cover",
      name: "Remover capa",
    });
  }

  onunload(): void {
    this.picker?.close();
    this.headers.destroy();
    document.body.style.removeProperty(COVER_HEIGHT_VAR);
  }

  /** Mantém o cabeçalho em dia com a nota aberta, o modo da view e o frontmatter. */
  private registerHeaderSync(): void {
    const { workspace, metadataCache } = this.app;
    const schedule = (): void => {
      this.headers.schedule();
    };

    workspace.onLayoutReady(schedule);
    this.registerEvent(workspace.on("layout-change", schedule));
    this.registerEvent(workspace.on("active-leaf-change", schedule));
    this.registerEvent(workspace.on("file-open", schedule));
    this.registerEvent(workspace.on("css-change", schedule));
    this.registerEvent(metadataCache.on("changed", schedule));
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) as Partial<MdPlusSettings> | null),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  applyCoverHeight(): void {
    document.body.style.setProperty(
      COVER_HEIGHT_VAR,
      `${this.settings.coverHeight}px`
    );
  }

  /** Abre o seletor de capa ancorado em `anchor`; sem âncora, abre centralizado. */
  openCoverPicker(sourcePath: string, anchor: HTMLElement | null = null): void {
    this.picker?.close();
    const file = this.app.vault.getFileByPath(sourcePath);
    const { cover } = dataFromFrontmatter(
      file ? this.app.metadataCache.getFileCache(file)?.frontmatter : null
    );

    const picker = new CoverPicker({
      anchor,
      current: cover,
      onPick: async (value, credit) => {
        await this.setCover(sourcePath, value, credit);
      },
      onRemove: async () => {
        await this.setCover(sourcePath, null);
      },
      plugin: this,
      sourcePath,
    });
    picker.onClose = () => {
      if (this.picker === picker) {
        this.picker = null;
      }
    };
    this.picker = picker;
    picker.open();
  }

  openIconPicker(sourcePath: string): void {
    const modal = new EmojiModal(this.app, async (emoji) => {
      await this.setIcon(sourcePath, emoji);
    });
    openModal(modal);
  }

  /** Grava a capa no frontmatter. `null` remove a capa e tudo que depende dela. */
  async setCover(
    sourcePath: string,
    value: string | null,
    credit?: CreditInfo
  ): Promise<void> {
    await this.updateNote(sourcePath, (fm) => {
      if (value === null) {
        removeKeys(fm, COVER_KEYS);
        return;
      }
      fm[FM.cover] = value;
      fm[FM.position] = 50;
      if (credit) {
        fm[FM.credit] = credit.name;
        fm[FM.creditUrl] = credit.url;
      } else {
        removeKeys(fm, [FM.credit, FM.creditUrl]);
      }
    });
  }

  async setPosition(sourcePath: string, position: number): Promise<void> {
    await this.updateNote(sourcePath, (fm) => {
      fm[FM.position] = position;
    });
  }

  async setIcon(sourcePath: string, emoji: string | null): Promise<void> {
    await this.updateNote(sourcePath, (fm) => {
      if (emoji === null) {
        removeKeys(fm, [FM.icon]);
      } else {
        fm[FM.icon] = emoji;
      }
    });
  }

  private async updateNote(
    sourcePath: string,
    write: FrontmatterWriter
  ): Promise<void> {
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!file) {
      return;
    }
    await this.app.fileManager.processFrontMatter(file, write);
  }

  /** Caminho da nota ativa. Avisa quando não há nenhuma aberta. */
  private activeNotePath(): string | null {
    const file: TFile | null = this.app.workspace.getActiveFile();
    if (!file) {
      notify("Abra uma nota primeiro.");
      return null;
    }
    return file.path;
  }
}
