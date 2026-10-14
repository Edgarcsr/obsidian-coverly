import { Notice, Plugin } from "obsidian";
import type { TFile } from "obsidian";

import { CoverPicker } from "./cover-picker";
import { setLanguage, t } from "./i18n";
import { IconPicker } from "./icon-picker";
import { LinkPreview } from "./link-preview";
import { COVER_KEYS, FM, dataFromFrontmatter } from "./note-data";
import type { CoverData, CreditInfo } from "./note-data";
import { NoteIconDecorator } from "./note-icons";
import {
  isColorPalette,
  isImageIcon,
  parseLucide,
  setColorPalette,
} from "./page-icon";
import { PopoverHeaders } from "./popover-header";
import { DEFAULT_SETTINGS, CoverlySettingTab } from "./settings";
import type { CoverlySettings } from "./settings";
import { TocManager } from "./toc";
import { closeTwemojiCache, loadTwemojiCache } from "./twemoji";
import { HeaderManager } from "./view-header";

/** Uma linha da grade de emojis. */
const MAX_RECENT_EMOJIS = 12;

/** SVGs do Twemoji já baixados, na pasta do plugin (ver twemoji.ts). */
const TWEMOJI_CACHE_FILE = "twemoji-cache.json";

type FrontmatterWriter = (fm: Record<string, unknown>) => void;

const COVER_VARS = [
  "--mdp-cover-height",
  "--mdp-cover-radius",
  "--mdp-cover-fade",
  "--mdp-cover-shade",
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

export default class CoverlyPlugin extends Plugin {
  settings: CoverlySettings = { ...DEFAULT_SETTINGS };
  private readonly headers = new HeaderManager(this);
  private readonly noteIcons = new NoteIconDecorator(this);
  private readonly toc = new TocManager(this);
  private readonly linkPreview = new LinkPreview(this);
  private readonly popoverHeaders = new PopoverHeaders(this);
  /** Só um seletor (de capa ou de ícone) aberto por vez. */
  private picker: CoverPicker | IconPicker | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    setLanguage(this.settings.language);
    setColorPalette(this.settings.colorPalette);
    this.applyCoverStyle();
    // Antes do primeiro desenho, para os emojis já baixados aparecerem na hora.
    const pluginDir =
      this.manifest.dir ??
      `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    await loadTwemojiCache(
      this.app.vault.adapter,
      `${pluginDir}/${TWEMOJI_CACHE_FILE}`
    );

    this.addSettingTab(new CoverlySettingTab(this.app, this));
    this.registerHeaderSync();
    this.linkPreview.register();
    this.popoverHeaders.register();

    this.addCommand({
      callback: () => {
        const path = this.activeNotePath();
        if (path) {
          this.openCoverPicker(path);
        }
      },
      id: "change-cover",
      name: t("command.changeCover"),
    });
    this.addCommand({
      callback: () => {
        const path = this.activeNotePath();
        if (path) {
          this.openIconPicker(path);
        }
      },
      id: "change-icon",
      name: t("command.changeIcon"),
    });
    this.addCommand({
      callback: async () => {
        const path = this.activeNotePath();
        if (path) {
          await this.setCover(path, null);
        }
      },
      id: "remove-cover",
      name: t("command.removeCover"),
    });
  }

  onunload(): void {
    this.picker?.close();
    this.headers.destroy();
    this.noteIcons.destroy();
    this.toc.destroy();
    this.linkPreview.destroy();
    this.popoverHeaders.destroy();
    void closeTwemojiCache();
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
      this.toc.schedule();
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
      ...((await this.loadData()) as Partial<CoverlySettings> | null),
    };
    // Uma paleta que não existe mais (ou valor estranho) volta para a padrão.
    if (!isColorPalette(this.settings.colorPalette)) {
      this.settings.colorPalette = DEFAULT_SETTINGS.colorPalette;
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Redesenha cabeçalhos e ícones depois de uma mudança nas configurações. */
  refreshHeaders(): void {
    this.headers.schedule();
    this.noteIcons.schedule();
    this.toc.schedule();
  }

  /** Passa altura, cantos, degradê e sombra da capa para o CSS, que os lê como variáveis. */
  applyCoverStyle(): void {
    const { coverFade, coverHeight, coverRadius, coverShade } = this.settings;
    const { style } = document.body;
    style.setProperty("--mdp-cover-height", `${coverHeight}px`);
    style.setProperty("--mdp-cover-radius", `${coverRadius}px`);
    style.setProperty("--mdp-cover-fade", `${coverFade}%`);
    style.setProperty("--mdp-cover-shade", `${coverShade}%`);
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
      notify(t("notice.openNote"));
      return null;
    }
    return file.path;
  }
}
