import { MarkdownView, Plugin } from "obsidian";

import { BackgroundPicker } from "./background-picker";
import { CoverPicker } from "./cover-picker";
import { setLanguage, t } from "./i18n";
import { IconPicker } from "./icon-picker";
import { LinkPreview } from "./link-preview";
import { DEFAULT_COLOR, showColorPopup } from "./note-color";
import {
  COVER_KEYS,
  FM,
  dataFromFrontmatter,
  migrateLegacyKeys,
} from "./note-data";
import type { CoverData, CreditInfo } from "./note-data";
import { showFontPopup } from "./note-font";
import type { NoteFont } from "./note-font";
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

export default class CoverlyPlugin extends Plugin {
  settings: CoverlySettings = { ...DEFAULT_SETTINGS };
  private readonly headers = new HeaderManager(this);
  private readonly noteIcons = new NoteIconDecorator(this);
  private readonly toc = new TocManager(this);
  private readonly linkPreview = new LinkPreview(this);
  private readonly popoverHeaders = new PopoverHeaders(this);
  /** Só um seletor (de capa ou de ícone) aberto por vez. */
  private picker: BackgroundPicker | CoverPicker | IconPicker | null = null;

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
      checkCallback: this.onActiveNote((path) => {
        this.openCoverPicker(path);
      }),
      id: "change-cover",
      name: t("command.changeCover"),
    });
    this.addCommand({
      checkCallback: this.onActiveNote((path) => {
        this.openIconPicker(path);
      }),
      id: "change-icon",
      name: t("command.changeIcon"),
    });
    this.addCommand({
      checkCallback: this.onActiveNote((path) => {
        void this.setCover(path, null);
      }),
      id: "remove-cover",
      name: t("command.removeCover"),
    });
    this.addCommand({
      checkCallback: (checking) =>
        this.settings.noteBackgrounds &&
        this.onActiveNote((path) => {
          this.openBackgroundPicker(path);
        })(checking),
      id: "change-background",
      name: t("command.changeBackground"),
    });
    this.addCommand({
      checkCallback: (checking) =>
        this.settings.noteBackgrounds &&
        this.onActiveNote((path) => {
          void this.setBackground(path, null);
        })(checking),
      id: "remove-background",
      name: t("command.removeBackground"),
    });
    this.addCommand({
      checkCallback: this.onActiveNote((path) => {
        this.openFontPopup(path);
      }),
      id: "change-font",
      name: t("command.changeFont"),
    });
    this.addCommand({
      checkCallback: (checking) =>
        this.settings.nameColors &&
        this.onActiveNote((path) => {
          this.openColorPopup(path);
        })(checking),
      id: "change-name-color",
      name: t("command.changeNameColor"),
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
    document.body.removeClass("mdp-tree-icon-inline");
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
    document.body.toggleClass(
      "mdp-tree-icon-inline",
      this.settings.treeIconPosition === "inline"
    );
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

  /** Abre o seletor de fundo da nota ancorado em `anchor`; sem âncora, abre centralizado. */
  openBackgroundPicker(
    sourcePath: string,
    anchor: HTMLElement | null = null
  ): void {
    this.picker?.close();
    const { background } = this.noteData(sourcePath);
    this.showPicker(
      new BackgroundPicker({
        anchor,
        current: background,
        onPick: async (value) => {
          await this.setBackground(sourcePath, value);
        },
        onRemove: async () => {
          await this.setBackground(sourcePath, null);
        },
        plugin: this,
      })
    );
  }

  /**
   * Abre o quadro de fonte da nota. Sem âncora, aparece no centro da nota aberta.
   */
  openFontPopup(sourcePath: string, anchor: HTMLElement | null = null): void {
    const box = (
      anchor ?? this.app.workspace.getActiveViewOfType(MarkdownView)?.contentEl
    )?.getBoundingClientRect();
    const position = anchor
      ? { x: box?.left ?? 0, y: box?.bottom ?? 0 }
      : {
          x: (box?.left ?? 0) + (box?.width ?? 0) / 2,
          y: (box?.top ?? 0) + (box?.height ?? 0) / 3,
        };
    showFontPopup({
      current: this.noteData(sourcePath).font,
      onPick: async (font) => {
        await this.setFont(sourcePath, font);
      },
      position,
    });
  }

  /** Abre o quadro de cores do nome da nota. Sem âncora, aparece no centro da nota aberta. */
  openColorPopup(sourcePath: string, anchor: HTMLElement | null = null): void {
    const box = (
      anchor ?? this.app.workspace.getActiveViewOfType(MarkdownView)?.contentEl
    )?.getBoundingClientRect();
    const position = anchor
      ? { x: box?.left ?? 0, y: box?.bottom ?? 0 }
      : {
          x: (box?.left ?? 0) + (box?.width ?? 0) / 2,
          y: (box?.top ?? 0) + (box?.height ?? 0) / 3,
        };
    showColorPopup({
      current: this.noteData(sourcePath).color,
      onPick: async (color) => {
        await this.setColor(sourcePath, color);
      },
      position,
    });
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

  private showPicker(
    picker: BackgroundPicker | CoverPicker | IconPicker
  ): void {
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

  async setBackground(sourcePath: string, value: string | null): Promise<void> {
    await this.updateNote(sourcePath, (fm) => {
      if (value === null) {
        removeKeys(fm, [FM.background]);
      } else {
        fm[FM.background] = value;
      }
    });
  }

  async setFont(sourcePath: string, font: NoteFont): Promise<void> {
    await this.updateNote(sourcePath, (fm) => {
      if (font === "default") {
        removeKeys(fm, [FM.font]);
      } else {
        fm[FM.font] = font;
      }
    });
  }

  async setColor(sourcePath: string, color: string): Promise<void> {
    await this.updateNote(sourcePath, (fm) => {
      if (color === DEFAULT_COLOR) {
        removeKeys(fm, [FM.color]);
      } else {
        fm[FM.color] = color;
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
    // Só notas markdown têm frontmatter: canvas, PDF e afins seriam corrompidos.
    if (!file || file.extension !== "md") {
      return;
    }
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      migrateLegacyKeys(fm);
      write(fm);
    });
  }

  /**
   * Adapta uma ação sobre a nota ativa para `checkCallback`: o comando só
   * aparece quando a view ativa é uma nota markdown, e não um canvas ou PDF.
   */
  private onActiveNote(
    action: (path: string) => void
  ): (checking: boolean) => boolean {
    return (checking) => {
      const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
      if (!file || file.extension !== "md") {
        return false;
      }
      if (!checking) {
        action(file.path);
      }
      return true;
    };
  }
}
