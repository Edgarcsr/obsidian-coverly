import { Notice, Plugin, addIcon } from "obsidian";
import type { MarkdownPostProcessorContext, Modal, TFile } from "obsidian";

import { CoverModal } from "./cover-modal";
import { EmojiModal } from "./emoji-modal";
import { buildHeader } from "./header";
import { ICONS } from "./icons";
import { coverLivePreview } from "./live-preview";
import { COVER_KEYS, FM, dataFromFrontmatter } from "./note-data";
import type { CreditInfo } from "./note-data";
import { DEFAULT_SETTINGS, MdPlusSettingTab } from "./settings";
import type { MdPlusSettings } from "./settings";

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

  async onload(): Promise<void> {
    await this.loadSettings();
    this.applyCoverHeight();
    for (const [id, svg] of Object.entries(ICONS)) {
      addIcon(id, svg);
    }

    this.addSettingTab(new MdPlusSettingTab(this.app, this));
    this.registerEditorExtension(coverLivePreview(this));
    this.registerMarkdownPostProcessor((el, ctx) => {
      this.renderReadingHeader(el, ctx);
    });

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

  // oxlint-disable-next-line class-methods-use-this
  onunload(): void {
    document.body.style.removeProperty(COVER_HEIGHT_VAR);
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

  openCoverPicker(sourcePath: string): void {
    const modal = new CoverModal(
      this.app,
      this,
      sourcePath,
      async (value, credit) => {
        await this.setCover(sourcePath, value, credit);
      }
    );
    openModal(modal);
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

  /** Modo de leitura: a capa entra antes do conteúdo da primeira seção. */
  private renderReadingHeader(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): void {
    const section = ctx.getSectionInfo(el);
    if (!section || section.lineStart !== 0) {
      return;
    }
    if (el.querySelector(":scope > .mdp-header")) {
      return;
    }

    const frontmatter = this.app.metadataCache.getCache(
      ctx.sourcePath
    )?.frontmatter;
    el.prepend(
      buildHeader(this, dataFromFrontmatter(frontmatter), ctx.sourcePath)
    );
  }
}
