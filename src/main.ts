import { Notice, Plugin } from "obsidian";
import type { TFile } from "obsidian";

import { CoverPicker } from "./cover-picker";
import { IconPicker } from "./icon-picker";
import { COVER_KEYS, FM, dataFromFrontmatter } from "./note-data";
import type { CoverData, CreditInfo } from "./note-data";
import { NoteIconDecorator } from "./note-icons";
import { isImageIcon, parseLucide } from "./page-icon";
import { DEFAULT_SETTINGS, MdPlusSettingTab } from "./settings";
import type { MdPlusSettings } from "./settings";
import { HeaderManager } from "./view-header";

/** Uma linha da grade de emojis. */
const MAX_RECENT_EMOJIS = 12;

type FrontmatterWriter = (fm: Record<string, unknown>) => void;

const COVER_VARS = [
  "--mdp-cover-height",
  "--mdp-cover-radius",
  "--mdp-cover-fade",
] as const;

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
  private readonly noteIcons = new NoteIconDecorator(this);
  /** Só um seletor (de capa ou de ícone) aberto por vez. */
  private picker: CoverPicker | IconPicker | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.applyCoverStyle();

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
    this.noteIcons.destroy();
    for (const name of COVER_VARS) {
      document.body.style.removeProperty(name);
    }
  }

  /**
   * Mantém o cabeçalho e os ícones do título e do explorador em dia com a
   * nota aberta, o modo da view e o frontmatter.
   */
  private registerHeaderSync(): void {
    const { workspace, metadataCache } = this.app;
    const schedule = (): void => {
      this.headers.schedule();
      this.noteIcons.schedule();
    };

    workspace.onLayoutReady(schedule);
    this.registerEvent(workspace.on("layout-change", schedule));
    this.registerEvent(workspace.on("active-leaf-change", schedule));
    this.registerEvent(workspace.on("file-open", schedule));
    this.registerEvent(workspace.on("css-change", schedule));
    this.registerEvent(metadataCache.on("changed", schedule));
    // No início o cache pode ainda não estar pronto quando o layout fica.
    this.registerEvent(metadataCache.on("resolved", schedule));
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

  /** Redesenha cabeçalhos e ícones depois de uma mudança nas configurações. */
  refreshHeaders(): void {
    this.headers.schedule();
    this.noteIcons.schedule();
  }

  /** Passa altura, cantos e degradê da capa para o CSS, que os lê como variáveis. */
  applyCoverStyle(): void {
    const { coverFade, coverHeight, coverRadius } = this.settings;
    const { style } = document.body;
    style.setProperty("--mdp-cover-height", `${coverHeight}px`);
    style.setProperty("--mdp-cover-radius", `${coverRadius}px`);
    style.setProperty("--mdp-cover-fade", `${coverFade}%`);
  }

  /** Abre o seletor de capa ancorado em `anchor`; sem âncora, abre centralizado. */
  openCoverPicker(sourcePath: string, anchor: HTMLElement | null = null): void {
    this.picker?.close();
    const { cover } = this.noteData(sourcePath);

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
    this.showPicker(picker);
  }

  /** Põe o emoji no topo da seção Recentes. Ícones Lucide e imagens não entram. */
  private async rememberEmoji(value: string): Promise<void> {
    if (parseLucide(value) !== null || isImageIcon(this.app, value)) {
      return;
    }
    this.settings.recentEmojis = [
      value,
      ...this.settings.recentEmojis.filter((emoji) => emoji !== value),
    ].slice(0, MAX_RECENT_EMOJIS);
    await this.saveSettings();
  }

  /** Abre o seletor de ícone ancorado em `anchor`; sem âncora, abre centralizado. */
  openIconPicker(sourcePath: string, anchor: HTMLElement | null = null): void {
    this.picker?.close();
    const { icon } = this.noteData(sourcePath);
    const picker = new IconPicker({
      anchor,
      app: this.app,
      // Um ícone colorido abre o seletor na cor dele; senão, na última usada.
      askColor: this.settings.askIconColor,
      color: parseLucide(icon ?? "")?.color ?? this.settings.iconColor,
      current: icon,
      onAskColorChange: async (askColor) => {
        this.settings.askIconColor = askColor;
        await this.saveSettings();
      },
      onColorChange: async (color) => {
        this.settings.iconColor = color;
        await this.saveSettings();
      },
      onPick: async (value) => {
        await this.setIcon(sourcePath, value);
        await this.rememberEmoji(value);
      },
      onRemove: async () => {
        await this.setIcon(sourcePath, null);
      },
      recentEmojis: this.settings.recentEmojis,
      sourcePath,
      twemoji: this.settings.twemoji,
    });
    this.showPicker(picker);
  }

  private showPicker(picker: CoverPicker | IconPicker): void {
    picker.onClose = () => {
      if (this.picker === picker) {
        this.picker = null;
      }
    };
    this.picker = picker;
    picker.open();
  }

  private noteData(sourcePath: string): CoverData {
    const file = this.app.vault.getFileByPath(sourcePath);
    return dataFromFrontmatter(
      file ? this.app.metadataCache.getFileCache(file)?.frontmatter : null
    );
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
