import type {
  App,
  Setting,
  SettingDefinitionItem,
  SettingDefinitionRender,
} from "obsidian";
import { PluginSettingTab } from "obsidian";

import { asyncListener } from "./async-listener";
import { DEFAULT_COVER_FOLDER } from "./cover-cache";
import type { FolderIcons } from "./folder-icons";
import { setLanguage, t } from "./i18n";
import type { Language } from "./i18n";
import { iconPackItems } from "./icon-packs-settings";
import { setIconTrim } from "./icon-trim";
import { extraLucideCount, setLucideExtras } from "./lucide-extra";
import type CoverlyPlugin from "./main";
import { setColorPalette } from "./page-icon";
import type { ColorPalette } from "./page-icon";
import { setPerfEnabled } from "./perf";
import {
  drawIconPosition,
  drawTreeBackgrounds,
  drawTreeIconPosition,
  renderChoice,
  renderCoverPreview,
} from "./settings-previews";
import type { Choice } from "./settings-previews";
import { clearCoverCache, coverlyUsage, describeUsage } from "./storage";

export type IconPosition = "above" | "inline";

/** Ícone no explorador: no recuo à esquerda ("indent") ou empurrando o nome ("inline"). */
export type TreeIconPosition = "indent" | "inline";

/** Fundos no explorador: nenhum, só nos arquivos de imagem, só nas notas com capa, ou em ambos. */
export type TreeBackgrounds = "off" | "images" | "notes" | "both";

export interface CoverlySettings {
  /** Idioma da interface: um fixo ou "auto", que segue o do Obsidian. */
  language: Language;
  unsplashKey: string;
  coverHeight: number;
  /** Raio dos cantos da capa, em pixels. 0 = cantos retos. */
  coverRadius: number;
  /** Quanto da altura da capa, de baixo para cima, some em degradê. 0 = sem degradê. */
  coverFade: number;
  /** Quanto da altura da capa, de baixo para cima, escurece em degradê preto. 0 = sem sombra. */
  coverShade: number;
  /** Deixa digitar o nome de qualquer fonte instalada como fonte de uma nota. */
  customFonts: boolean;
  /** A capa entra com esmaecer e zoom ao abrir uma nota. */
  coverAnimation: boolean;
  /** Guarda uma cópia local das capas da internet, para abrirem do disco. */
  downloadCovers: boolean;
  /** Pasta do vault onde ficam as cópias locais das capas. */
  coverFolder: string;
  /** Onde fica o ícone da página: grande sobre a capa ("above") ou antes do texto do título ("inline"). */
  iconPosition: IconPosition;
  /** Onde fica o ícone das notas no explorador de arquivos. */
  treeIconPosition: TreeIconPosition;
  /** Miniaturas como fundo dos itens do explorador (imagens, notas com capa, ambos). */
  treeBackgrounds: TreeBackgrounds;
  /** Cores dos ícones: as do Notion ou as do Tailwind (a paleta original). */
  colorPalette: ColorPalette;
  /** Última cor usada na aba Ícones, para abrir já com ela. */
  iconColor: string;
  /** Clicar num ícone mostra as variantes de cor antes de escolher. */
  askIconColor: boolean;
  /** Ícone de cada pasta, pelo caminho (ver folder-icons.ts). */
  folderIcons: FolderIcons;
  /** Última aba aberta no seletor de ícone, para abrir nela da próxima vez. */
  iconTab: "emoji" | "icons" | "upload";
  /** Último pacote aberto na aba Ícones ("lucide" ou o id de um instalado). */
  iconPack: string;
  /** Pacotes que não aparecem como sub-abas no seletor (o Lucide também pode). */
  hiddenIconPacks: string[];
  /** Emojis usados por último, do mais recente para o mais antigo. */
  recentEmojis: string[];
  /** Desenha os emojis no estilo do X (Twemoji, baixado do jsDelivr). */
  twemoji: boolean;
  /** Pinta o nome de cada nota no explorador com a cor escolhida para ela. */
  nameColors: boolean;
  /** Deixa dar a cada nota uma cor de destaque própria, no lugar da do tema. */
  noteAccents: boolean;
  /** Deixa dar a cada nota um fundo próprio (cor, gradiente ou imagem). */
  noteBackgrounds: boolean;
  /** Mostra o sumário de títulos na lateral direita da nota. */
  toc: boolean;
  /** Mostra um cartão de prévia ao passar o mouse sobre um link interno. */
  linkPreview: boolean;
  /** Acrescenta ao Lucide os ícones que o Obsidian não traz (ver lucide-extra.ts). */
  lucideExtras: boolean;
  /** Esconde a dica do Obsidian (datas) nas notas do explorador, já que o cartão as mostra. */
  hideFileTooltip: boolean;
  /** Mede o tempo dos trechos mais caros (só na memória, sem enviar nada). */
  perfMonitor: boolean;
  /** Corta as margens vazias das imagens usadas como ícone (sem alterar os arquivos). */
  iconTrim: boolean;
}

export const DEFAULT_SETTINGS: CoverlySettings = {
  askIconColor: true,
  colorPalette: "tailwind",
  coverAnimation: false,
  coverFade: 0,
  coverFolder: DEFAULT_COVER_FOLDER,
  coverHeight: 240,
  coverRadius: 0,
  coverShade: 35,
  customFonts: false,
  downloadCovers: false,
  folderIcons: {},
  hiddenIconPacks: [],
  hideFileTooltip: true,
  iconColor: "default",
  iconPack: "lucide",
  iconPosition: "above",
  iconTab: "emoji",
  iconTrim: false,
  language: "auto",
  linkPreview: true,
  lucideExtras: false,
  nameColors: false,
  noteAccents: false,
  noteBackgrounds: false,
  perfMonitor: false,
  recentEmojis: [],
  toc: true,
  treeBackgrounds: "off",
  treeIconPosition: "indent",
  twemoji: true,
  unsplashKey: "",
};

type ControlKey =
  | "language"
  | "unsplashKey"
  | "coverHeight"
  | "coverRadius"
  | "coverFade"
  | "coverShade"
  | "customFonts"
  | "coverAnimation"
  | "downloadCovers"
  | "coverFolder"
  | "colorPalette"
  | "iconPosition"
  | "treeIconPosition"
  | "treeBackgrounds"
  | "twemoji"
  | "toc"
  | "linkPreview"
  | "lucideExtras"
  | "hideFileTooltip"
  | "askIconColor"
  | "nameColors"
  | "noteAccents"
  | "noteBackgrounds"
  | "perfMonitor"
  | "iconTrim";

/** As opções que o `applyChange` trata; as outras têm o próprio caso em `setControlValue`. */
type ChangeKey = Exclude<
  ControlKey,
  "iconTrim" | "lucideExtras" | "perfMonitor"
>;

export class CoverlySettingTab extends PluginSettingTab {
  private readonly plugin: CoverlyPlugin;

  constructor(app: App, plugin: CoverlyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /** Declarative definition (Obsidian 1.13+): also feeds the settings search. */
  // oxlint-disable-next-line class-methods-use-this
  getSettingDefinitions(): SettingDefinitionItem<ControlKey>[] {
    const slider = (key: ControlKey, max: number, step: number, min = 0) =>
      ({ key, max, min, step, type: "slider" }) as const;
    const named = (key: ControlKey) => ({
      desc: t(`settings.${key}.desc`),
      name: t(`settings.${key}.name`),
    });

    // O Lucide primeiro; a opção dos ícones extras logo abaixo dele.
    const [lucideRow, ...packRows] = iconPackItems(this.plugin);

    return [
      {
        heading: t("settings.section.general"),
        items: [
          {
            ...named("language"),
            control: {
              key: "language",
              options: {
                auto: t("settings.language.auto"),
                en: "English",
                pt: "Português",
              },
              type: "dropdown",
            },
          },
        ],
        type: "group",
      },
      {
        heading: t("settings.section.covers"),
        items: [
          {
            name: t("settings.coverPreview.name"),
            render: (setting) => {
              renderCoverPreview(setting, this.plugin);
            },
          },
          {
            ...named("unsplashKey"),
            control: { key: "unsplashKey", type: "secret" },
          },
          {
            ...named("coverHeight"),
            control: slider("coverHeight", 400, 10, 120),
          },
          { ...named("coverRadius"), control: slider("coverRadius", 40, 2) },
          { ...named("coverFade"), control: slider("coverFade", 100, 5) },
          { ...named("coverShade"), control: slider("coverShade", 100, 5) },
          {
            ...named("coverAnimation"),
            control: { key: "coverAnimation", type: "toggle" },
          },
          this.choice("treeBackgrounds", [
            {
              draw: drawTreeBackgrounds(this.plugin, "both"),
              label: t("settings.treeBackgrounds.both"),
              value: "both",
            },
            {
              draw: drawTreeBackgrounds(this.plugin, "images"),
              label: t("settings.treeBackgrounds.images"),
              value: "images",
            },
            {
              draw: drawTreeBackgrounds(this.plugin, "notes"),
              label: t("settings.treeBackgrounds.notes"),
              value: "notes",
            },
            {
              draw: drawTreeBackgrounds(this.plugin, "off"),
              label: t("settings.treeBackgrounds.off"),
              value: "off",
            },
          ]),
          {
            ...named("downloadCovers"),
            control: { key: "downloadCovers", type: "toggle" },
          },
          {
            ...named("coverFolder"),
            control: {
              key: "coverFolder",
              placeholder: DEFAULT_COVER_FOLDER,
              type: "text",
            },
          },
          {
            name: t("settings.storage.name"),
            render: (setting) => {
              this.renderStorage(setting);
            },
          },
        ],
        type: "group",
      },
      {
        heading: t("settings.section.icons"),
        items: [
          this.choice("iconPosition", [
            {
              draw: drawIconPosition(this.plugin, "above"),
              label: t("settings.iconPosition.above"),
              value: "above",
            },
            {
              draw: drawIconPosition(this.plugin, "inline"),
              label: t("settings.iconPosition.inline"),
              value: "inline",
            },
          ]),
          this.choice("treeIconPosition", [
            {
              draw: drawTreeIconPosition(this.plugin, "indent"),
              label: t("settings.treeIconPosition.indent"),
              value: "indent",
            },
            {
              draw: drawTreeIconPosition(this.plugin, "inline"),
              label: t("settings.treeIconPosition.inline"),
              value: "inline",
            },
          ]),
          {
            ...named("colorPalette"),
            control: {
              key: "colorPalette",
              options: {
                notion: t("settings.colorPalette.notion"),
                tailwind: t("settings.colorPalette.tailwind"),
              },
              type: "dropdown",
            },
          },
          {
            ...named("askIconColor"),
            control: { key: "askIconColor", type: "toggle" },
          },
          { ...named("twemoji"), control: { key: "twemoji", type: "toggle" } },
          {
            ...named("iconTrim"),
            control: { key: "iconTrim", type: "toggle" },
          },
        ],
        type: "group",
      },
      {
        heading: t("settings.section.iconPacks"),
        items: [
          ...(lucideRow ? [lucideRow] : []),
          {
            control: { key: "lucideExtras", type: "toggle" },
            desc: t("settings.lucideExtras.desc", {
              count: extraLucideCount(),
            }),
            name: t("settings.lucideExtras.name"),
          },
          ...packRows,
        ],
        type: "group",
      },
      {
        heading: t("settings.section.perNote"),
        items: [
          {
            ...named("noteBackgrounds"),
            control: { key: "noteBackgrounds", type: "toggle" },
          },
          {
            ...named("noteAccents"),
            control: { key: "noteAccents", type: "toggle" },
          },
          {
            ...named("customFonts"),
            control: { key: "customFonts", type: "toggle" },
          },
          {
            ...named("nameColors"),
            control: { key: "nameColors", type: "toggle" },
          },
        ],
        type: "group",
      },
      {
        heading: t("settings.section.navigation"),
        items: [
          { ...named("toc"), control: { key: "toc", type: "toggle" } },
          {
            ...named("linkPreview"),
            control: { key: "linkPreview", type: "toggle" },
          },
          {
            ...named("hideFileTooltip"),
            control: { key: "hideFileTooltip", type: "toggle" },
          },
        ],
        type: "group",
      },
      {
        heading: t("settings.section.developer"),
        items: [
          {
            ...named("perfMonitor"),
            control: { key: "perfMonitor", type: "toggle" },
          },
        ],
        type: "group",
      },
    ];
  }

  /** Opção de um grupo fixo, com uma prévia do resultado da escolha. */
  private choice(key: ControlKey, choices: Choice[]): SettingDefinitionRender {
    return {
      desc: t(`settings.${key}.desc`),
      name: t(`settings.${key}.name`),
      render: (setting) => {
        renderChoice(
          setting,
          choices,
          String(this.getControlValue(key)),
          async (value) => {
            await this.setControlValue(key, value);
          }
        );
      },
    };
  }

  /** Espaço usado pela pasta do Coverly e o botão de limpar o que se refaz. */
  private renderStorage(setting: Setting): void {
    const { app } = this.plugin;
    const refresh = async (): Promise<void> => {
      setting.setDesc(describeUsage(await coverlyUsage(app)));
    };
    setting.setDesc(t("settings.storage.loading"));
    setting.addButton((button) => {
      button.setButtonText(t("settings.storage.clear")).onClick(
        asyncListener(async () => {
          button.setDisabled(true);
          await clearCoverCache(app);
          await this.plugin.configureCoverCache();
          await refresh();
          button.setDisabled(false);
        })
      );
    });
    void refresh();
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as ControlKey];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "iconTrim") {
      this.plugin.settings.iconTrim = value as boolean;
      setIconTrim(this.plugin.settings.iconTrim);
      this.plugin.refreshHeaders();
      await this.plugin.saveSettings();
      return;
    }
    if (key === "perfMonitor") {
      this.plugin.settings.perfMonitor = value as boolean;
      setPerfEnabled(this.plugin.settings.perfMonitor);
      await this.plugin.saveSettings();
      return;
    }
    if (key === "lucideExtras") {
      this.plugin.settings.lucideExtras = value as boolean;
      setLucideExtras(this.plugin.settings.lucideExtras);
      this.plugin.refreshHeaders();
      await this.plugin.saveSettings();
      return;
    }
    await this.applyChange(key as ChangeKey, value);
  }

  private async applyChange(key: ChangeKey, value: unknown): Promise<void> {
    const { plugin } = this;
    const { settings } = plugin;

    if (key === "language") {
      settings.language = value as Language;
      setLanguage(settings.language);
      plugin.refreshHeaders();
    } else if (key === "unsplashKey") {
      settings.unsplashKey = String(value).trim();
    } else if (key === "colorPalette") {
      settings.colorPalette = value as ColorPalette;
      setColorPalette(settings.colorPalette);
    } else if (key === "iconPosition") {
      settings.iconPosition = value as IconPosition;
      plugin.refreshHeaders();
    } else if (key === "treeBackgrounds") {
      settings.treeBackgrounds = value as TreeBackgrounds;
      plugin.refreshHeaders();
    } else if (key === "treeIconPosition") {
      settings.treeIconPosition = value as TreeIconPosition;
      plugin.applyCoverStyle();
    } else if (key === "downloadCovers") {
      settings.downloadCovers = value as boolean;
      await plugin.configureCoverCache();
    } else if (key === "coverFolder") {
      settings.coverFolder = String(value).trim();
      await plugin.configureCoverCache();
    } else if (
      key === "linkPreview" ||
      key === "coverAnimation" ||
      key === "hideFileTooltip" ||
      key === "askIconColor"
    ) {
      // Vale a partir da próxima nota aberta; não precisa redesenhar.
      settings[key] = value as boolean;
    } else if (
      key === "twemoji" ||
      key === "toc" ||
      key === "customFonts" ||
      key === "nameColors" ||
      key === "noteAccents" ||
      key === "noteBackgrounds"
    ) {
      settings[key] = value as boolean;
      plugin.refreshHeaders();
    } else {
      settings[key] = value as number;
      plugin.applyCoverStyle();
    }

    await plugin.saveSettings();
    if (key === "language") {
      // Redesenha esta tela já no novo idioma.
      this.update();
    }
  }
}
