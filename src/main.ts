import { MarkdownView, Plugin } from "obsidian";

import { BackgroundPicker } from "./background-picker";
import {
  DEFAULT_COVER_FOLDER,
  LEGACY_COVER_FOLDER,
  cacheCover,
  configureCoverCache,
} from "./cover-cache";
import { CoverPicker } from "./cover-picker";
import {
  configureCoverThumbs,
  setThumbListener,
  thumbStats,
  warmCoverThumbs,
} from "./cover-thumbs";
import { downloadAllCovers } from "./download-covers";
import { loadEmojiData } from "./emojis";
import { registerFileMenu } from "./file-menu";
import type { PopupPosition } from "./floating-popup";
import { folderIcon, registerFolderIconSync } from "./folder-icons";
import { headerCacheStats } from "./header";
import { setLanguage, t } from "./i18n";
import { packInfo } from "./icon-pack-catalog";
import {
  configureIconPacks,
  installedPacks,
  preloadIconPacks,
  parsePackIcon,
} from "./icon-packs";
import { IconPicker, LUCIDE_PACK } from "./icon-picker";
import type { PickerPack, Tab as IconTab } from "./icon-picker";
import { setIconTrim } from "./icon-trim";
import { LinkPreview } from "./link-preview";
import { setLucideExtras } from "./lucide-extra";
import { loadLucideData } from "./lucide-search";
import { DEFAULT_COLOR, showColorPopup } from "./note-color";
import {
  COVER_KEYS,
  DEFAULT_ZOOM,
  FM,
  dataFromFrontmatter,
  isRemoteCover,
  migrateLegacyKeys,
} from "./note-data";
import type { CoverData, CreditInfo } from "./note-data";
import { showFontPopup } from "./note-font";
import { NoteIconDecorator } from "./note-icons";
import {
  isColorPalette,
  isImageIcon,
  parseLucide,
  setColorPalette,
} from "./page-icon";
import {
  measureAsync,
  recordDuration,
  registerGauge,
  setPerfEnabled,
} from "./perf";
import { PerfModal } from "./perf-modal";
import { PopoverHeaders } from "./popover-header";
import { DEFAULT_SETTINGS, CoverlySettingTab } from "./settings";
import type { CoverlySettings } from "./settings";
import { formatSize } from "./storage";
import { TocManager } from "./toc";
import { closeTwemojiCache, loadTwemojiCache } from "./twemoji";
import { HeaderManager } from "./view-header";

/** Espera depois do layout pronto antes de gerar as miniaturas em segundo plano. */
const WARM_THUMBS_DELAY_MS = 3000;

/** Uma linha da grade de emojis. */
const MAX_RECENT_EMOJIS = 12;

/** SVGs do Twemoji já baixados, na pasta do plugin (ver twemoji.ts). */
const TWEMOJI_CACHE_FILE = "twemoji-cache.json";

/** "chave 3 · outra 5": tamanhos de caches numa linha do relatório. */
const pairs = (stats: Record<string, number>): string =>
  Object.entries(stats)
    .map(([name, value]) => `${name} ${value}`)
    .join(" · ");

/** Parte não documentada do `app` que abre a tela de configurações. */
interface SettingManager {
  open: () => void;
  openTabById: (id: string) => void;
}

type FrontmatterWriter = (fm: Record<string, unknown>) => void;

/** Dono do ícone que o seletor vai mudar: uma nota ou uma pasta. */
interface IconTarget {
  anchor: HTMLElement | null;
  current: string | undefined;
  /** Nota ou pasta dona do ícone. */
  path: string;
  /** Grava o ícone escolhido; `null` remove. */
  save: (value: string | null) => Promise<void>;
  tab: IconTab;
  /** Trocar de aba vira a aba em que o seletor das notas abre. */
  rememberTab: boolean;
}

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
    const loadStart = performance.now();
    await this.loadSettings();
    setPerfEnabled(this.settings.perfMonitor);
    setIconTrim(this.settings.iconTrim);
    this.registerPerfGauges();
    setLanguage(this.settings.language);
    setColorPalette(this.settings.colorPalette);
    setLucideExtras(this.settings.lucideExtras);
    this.applyCoverStyle();
    // Antes do primeiro desenho, para os emojis já baixados aparecerem na hora.
    const pluginDir =
      this.manifest.dir ??
      `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    // Os caches são independentes: lê-los em paralelo encurta o carregamento.
    const twemojiCache = loadTwemojiCache(
      this.app.vault.adapter,
      `${pluginDir}/${TWEMOJI_CACHE_FILE}`
    );

    // Pacote de ícones lido do disco: os ícones dele podem aparecer agora.
    configureIconPacks(this.app, () => {
      this.refreshHeaders();
    });

    // Antes do primeiro desenho, para as capas já baixadas abrirem do disco.
    // Os pacotes de ícones vêm junto (a pasta deles é definida logo no começo
    // de configureCoverCache), para os ícones já saírem na primeira pintura.
    await this.migrateCoverFolder();
    await Promise.all([
      twemojiCache,
      this.configureCoverCache(),
      preloadIconPacks(this.app),
    ]);
    // Miniatura nova pronta: o explorador pode trocar o fundo da nota.
    setThumbListener(() => {
      this.noteIcons.schedule();
    });

    // Com o vault já indexado, adianta as miniaturas sem disputar o início.
    this.app.workspace.onLayoutReady(() => {
      const timer = window.setTimeout(() => {
        warmCoverThumbs(this.app);
      }, WARM_THUMBS_DELAY_MS);
      this.register(() => {
        window.clearTimeout(timer);
      });
    });

    this.addSettingTab(new CoverlySettingTab(this.app, this));
    // O Obsidian ordena a barra pela ordem de registro, e os plugins do núcleo
    // põem os botões deles só quando o layout fica pronto: registrar aqui,
    // no onload, deixava o do Coverly em primeiro.
    this.app.workspace.onLayoutReady(() => {
      this.addRibbonIcon("swatch-book", t("command.openSettings"), () => {
        this.openSettings();
      });
    });
    this.registerHeaderSync();
    registerFolderIconSync(this);
    registerFileMenu(this);
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
        void this.openIconPicker(path);
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
        this.settings.noteAccents &&
        this.onActiveNote((path) => {
          this.openAccentPopup(path);
        })(checking),
      id: "change-accent-color",
      name: t("command.changeAccentColor"),
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
    this.addCommand({
      callback: () => {
        this.openSettings();
      },
      id: "open-settings",
      name: t("command.openSettings"),
    });
    this.addCommand({
      callback: () => {
        new PerfModal(this.app).open();
      },
      id: "show-performance-report",
      name: t("command.showPerformanceReport"),
    });
    this.addCommand({
      callback: async () => {
        await downloadAllCovers(this.app);
      },
      id: "download-covers",
      name: t("command.downloadCovers"),
    });
    recordDuration("plugin.onload", performance.now() - loadStart);
  }

  /** Valores lidos só ao abrir o relatório de desempenho (ver perf.ts). */
  private registerPerfGauges(): void {
    registerGauge("thumbs", () => pairs(thumbStats()));
    registerGauge("imageCaches", () => pairs(headerCacheStats()));
    registerGauge("explorerObservers", () => this.noteIcons.observerCount());
    registerGauge("headerViews", () => this.headers.viewCount());
    const { memory } = performance as Performance & {
      memory?: { usedJSHeapSize: number };
    };
    if (memory) {
      registerGauge("jsHeap", () => formatSize(memory.usedJSHeapSize));
    }
  }

  /**
   * Abre a tela de configurações já na aba do Coverly. `app.setting` não está
   * na API pública; sem ele (versão diferente do Obsidian), nada acontece.
   */
  openSettings(): void {
    const { setting } = this.app as unknown as { setting?: SettingManager };
    setting?.open();
    setting?.openTabById(this.manifest.id);
  }

  /** Aplica as opções de cópia local das capas (ver cover-cache.ts) e das miniaturas. */
  async configureCoverCache(): Promise<void> {
    // A pasta atual é definida antes do primeiro await; a leitura das imagens
    // pode começar junto com a das miniaturas, que fica na subpasta.
    const covers = configureCoverCache({
      app: this.app,
      enabled: this.settings.downloadCovers,
      folder: this.settings.coverFolder,
    });
    await Promise.all([covers, configureCoverThumbs(this.app)]);
  }

  /**
   * A pasta padrão era `.cover`; agora é `.coverly`, que é do plugin inteiro.
   * Quem ainda usa o nome antigo tem a pasta renomeada uma vez. Se já existe
   * uma `.coverly`, nada é movido e a configuração fica como estava.
   */
  private async migrateCoverFolder(): Promise<void> {
    if (this.settings.coverFolder !== LEGACY_COVER_FOLDER) {
      return;
    }
    const { adapter } = this.app.vault;
    try {
      if (await adapter.exists(DEFAULT_COVER_FOLDER)) {
        return;
      }
      if (await adapter.exists(LEGACY_COVER_FOLDER)) {
        await adapter.rename(LEGACY_COVER_FOLDER, DEFAULT_COVER_FOLDER);
      }
    } catch {
      // Sem permissão para renomear: segue com a pasta antiga.
      return;
    }
    this.settings.coverFolder = DEFAULT_COVER_FOLDER;
    await this.saveSettings();
  }

  onunload(): void {
    this.picker?.close();
    setThumbListener(null);
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

    // Quando o layout fica pronto, o Obsidian já desenhou os títulos e o
    // explorador, mas a tela ainda não foi pintada. Desenhar agora, e não no
    // próximo frame, põe os ícones na mesma pintura: o título não aparece
    // sem o ícone para depois andar para o lado quando ele chega.
    workspace.onLayoutReady(() => {
      this.headers.flush();
      this.noteIcons.flush();
      this.toc.schedule();
    });
    this.registerEvent(workspace.on("layout-change", schedule));
    this.registerEvent(workspace.on("active-leaf-change", schedule));
    this.registerEvent(
      workspace.on("file-open", () => {
        // O cabeçalho troca junto com a nota, no mesmo frame (ver flush).
        this.headers.flush();
        schedule();
      })
    );
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
    // A opção "capas no explorador" (liga/desliga) virou uma escolha.
    const legacy = this.settings as Partial<Record<"treeCovers", boolean>>;
    if (legacy.treeCovers !== undefined) {
      this.settings.treeBackgrounds = legacy.treeCovers ? "notes" : "off";
      Reflect.deleteProperty(legacy, "treeCovers");
    }
    // Cópia própria: o objeto padrão não pode receber os ícones.
    this.settings.folderIcons = { ...this.settings.folderIcons };
    this.settings.hiddenIconPacks = [...this.settings.hiddenIconPacks];
    // A aba Pastas virou o pacote Symbols, dentro da aba Ícones.
    if (!["emoji", "icons", "upload"].includes(this.settings.iconTab)) {
      this.settings.iconTab = "icons";
    }
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
        sourcePath,
      })
    );
  }

  /** Onde abrir um quadro: junto à âncora, ou no centro da nota aberta. */
  private popupPosition(anchor: HTMLElement | null): PopupPosition {
    const box = (
      anchor ?? this.app.workspace.getActiveViewOfType(MarkdownView)?.contentEl
    )?.getBoundingClientRect();
    if (anchor) {
      return { opener: anchor, x: box?.left ?? 0, y: box?.bottom ?? 0 };
    }
    return {
      x: (box?.left ?? 0) + (box?.width ?? 0) / 2,
      y: (box?.top ?? 0) + (box?.height ?? 0) / 3,
    };
  }

  /** Abre o quadro de fonte da nota. Sem âncora, aparece no centro da nota aberta. */
  openFontPopup(sourcePath: string, anchor: HTMLElement | null = null): void {
    showFontPopup({
      allowCustom: this.settings.customFonts,
      current: this.noteData(sourcePath).font,
      onPick: async (font) => {
        await this.setFont(sourcePath, font);
      },
      onPickCustom: async (family) => {
        await this.setFont(sourcePath, family);
      },
      position: this.popupPosition(anchor),
    });
  }

  /** Abre o quadro de cores do nome da nota. Sem âncora, aparece no centro da nota aberta. */
  openColorPopup(sourcePath: string, anchor: HTMLElement | null = null): void {
    showColorPopup({
      current: this.noteData(sourcePath).color,
      onPick: async (color) => {
        await this.setColor(sourcePath, color);
      },
      position: this.popupPosition(anchor),
      title: t("header.nameColor"),
    });
  }

  /** Abre o quadro de cores de destaque da nota. Sem âncora, aparece no centro da nota aberta. */
  openAccentPopup(sourcePath: string, anchor: HTMLElement | null = null): void {
    showColorPopup({
      current: this.noteData(sourcePath).accent,
      onPick: async (color) => {
        await this.setAccent(sourcePath, color);
      },
      position: this.popupPosition(anchor),
      title: t("header.accentColor"),
    });
  }

  /** Põe o emoji no topo da seção Recentes. Ícones Lucide, de pasta e imagens não entram. */
  private async rememberEmoji(value: string): Promise<void> {
    if (
      parseLucide(value) !== null ||
      parsePackIcon(value) !== null ||
      isImageIcon(this.app, value)
    ) {
      return;
    }
    this.settings.recentEmojis = [
      value,
      ...this.settings.recentEmojis.filter((emoji) => emoji !== value),
    ].slice(0, MAX_RECENT_EMOJIS);
    await this.saveSettings();
  }

  /** Abre o seletor de ícone da nota ancorado em `anchor`; sem âncora, abre centralizado. */
  async openIconPicker(
    sourcePath: string,
    anchor: HTMLElement | null = null
  ): Promise<void> {
    await this.showIconPicker({
      anchor,
      current: this.noteData(sourcePath).icon,
      path: sourcePath,
      rememberTab: true,
      save: async (value) => {
        await this.setIcon(sourcePath, value);
      },
      tab: this.settings.iconTab,
    });
  }

  /**
   * Abre o seletor de ícone da pasta. Começa sempre na aba Ícones, e trocar
   * de aba aqui não muda a aba em que o seletor das notas abre.
   */
  async openFolderIconPicker(
    folderPath: string,
    anchor: HTMLElement | null = null
  ): Promise<void> {
    await this.showIconPicker({
      anchor,
      current: this.folderIcon(folderPath),
      path: folderPath,
      rememberTab: false,
      save: async (value) => {
        await this.setFolderIcon(folderPath, value);
      },
      tab: "icons",
    });
  }

  /**
   * Sub-abas da aba Ícones: o Lucide e os pacotes instalados, menos os
   * ocultos. Se tudo estiver oculto, fica o Lucide.
   */
  private async pickerPacks(): Promise<PickerPack[]> {
    const installed = await installedPacks(this.app);
    const packs: PickerPack[] = [
      { id: LUCIDE_PACK, name: "Lucide", tintable: true },
      ...installed.flatMap((id) => {
        const info = packInfo(id);
        return info ? [{ id, name: info.name, tintable: info.tintable }] : [];
      }),
    ];
    const visible = packs.filter(
      (pack) => !this.settings.hiddenIconPacks.includes(pack.id)
    );
    return visible.length > 0 ? visible : packs.slice(0, 1);
  }

  private async showIconPicker(target: IconTarget): Promise<void> {
    this.picker?.close();
    const [packs] = await Promise.all([
      this.pickerPacks(),
      loadEmojiData(),
      loadLucideData(),
    ]);
    this.picker?.close();
    const { current } = target;
    const currentColor =
      parseLucide(current ?? "")?.color ?? parsePackIcon(current ?? "")?.color;
    const picker = new IconPicker({
      anchor: target.anchor,
      app: this.app,
      // Um ícone colorido abre o seletor na cor dele; senão, na última usada.
      askColor: this.settings.askIconColor,
      color: currentColor ?? this.settings.iconColor,
      current,
      onAskColorChange: async (askColor) => {
        this.settings.askIconColor = askColor;
        await this.saveSettings();
      },
      onColorChange: async (color) => {
        this.settings.iconColor = color;
        await this.saveSettings();
      },
      onPackChange: (pack) => {
        this.settings.iconPack = pack;
        void this.saveSettings();
      },
      onPick: async (value) => {
        await target.save(value);
        await this.rememberEmoji(value);
      },
      onRemove: async () => {
        await target.save(null);
      },
      onTabChange: (tab) => {
        if (target.rememberTab) {
          this.settings.iconTab = tab;
          void this.saveSettings();
        }
      },
      pack: this.settings.iconPack,
      packs,
      recentEmojis: this.settings.recentEmojis,
      sourcePath: target.path,
      tab: target.tab,
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
    // Baixa antes de gravar: a capa nova já aparece do disco, sem esperar a rede.
    if (value && isRemoteCover(value)) {
      await cacheCover(value);
    }
    await this.updateNote(sourcePath, (fm) => {
      if (value === null) {
        removeKeys(fm, COVER_KEYS);
        return;
      }
      fm[FM.cover] = value;
      fm[FM.position] = 50;
      fm[FM.positionX] = 50;
      // Foto nova começa no encaixe padrão, sem o zoom da anterior.
      removeKeys(fm, [FM.zoom]);
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

  /** `font` é "default" (sem propriedade), uma fonte pronta ou o nome de uma personalizada. */
  async setFont(sourcePath: string, font: string): Promise<void> {
    await this.updateNote(sourcePath, (fm) => {
      if (font === "default") {
        removeKeys(fm, [FM.font]);
      } else {
        fm[FM.font] = font;
      }
    });
  }

  async setAccent(sourcePath: string, color: string): Promise<void> {
    await this.updateNote(sourcePath, (fm) => {
      if (color === DEFAULT_COLOR) {
        removeKeys(fm, [FM.accent]);
      } else {
        fm[FM.accent] = color;
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

  async setFrame(
    sourcePath: string,
    frame: { x: number; y: number; zoom: number }
  ): Promise<void> {
    const { x, y, zoom } = frame;
    await this.updateNote(sourcePath, (fm) => {
      fm[FM.position] = y;
      fm[FM.positionX] = x;
      // O zoom padrão não precisa ficar gravado na nota.
      if (zoom === DEFAULT_ZOOM) {
        removeKeys(fm, [FM.zoom]);
      } else {
        fm[FM.zoom] = zoom;
      }
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

  /** Ícone gravado no frontmatter da nota, se houver. */
  noteIcon(sourcePath: string): string | undefined {
    return this.noteData(sourcePath).icon;
  }

  /** Ícone da pasta, se ela tiver um. */
  folderIcon(folderPath: string): string | undefined {
    return folderIcon(this.settings.folderIcons, folderPath);
  }

  /** Grava o ícone da pasta nas configurações. `null` remove. */
  async setFolderIcon(folderPath: string, value: string | null): Promise<void> {
    if (value === null) {
      Reflect.deleteProperty(this.settings.folderIcons, folderPath);
    } else {
      this.settings.folderIcons[folderPath] = value;
    }
    await this.saveSettings();
    this.noteIcons.schedule();
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
    await measureAsync("note.save", () =>
      this.app.fileManager.processFrontMatter(
        file,
        (fm: Record<string, unknown>) => {
          migrateLegacyKeys(fm);
          write(fm);
        }
      )
    );
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
