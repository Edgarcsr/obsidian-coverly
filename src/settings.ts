import type { App, SettingDefinitionItem } from "obsidian";
import { PluginSettingTab } from "obsidian";

import { setLanguage, t } from "./i18n";
import type { Language } from "./i18n";
import type CoverlyPlugin from "./main";
import { setColorPalette } from "./page-icon";
import type { ColorPalette } from "./page-icon";

export type IconPosition = "above" | "inline";

/** Ícone no explorador: no recuo à esquerda ("indent") ou empurrando o nome ("inline"). */
export type TreeIconPosition = "indent" | "inline";

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
  /** Onde fica o ícone da página: grande sobre a capa ("above") ou antes do texto do título ("inline"). */
  iconPosition: IconPosition;
  /** Onde fica o ícone das notas no explorador de arquivos. */
  treeIconPosition: TreeIconPosition;
  /** Cores dos ícones: as do Notion ou as do Tailwind (a paleta original). */
  colorPalette: ColorPalette;
  /** Última cor usada na aba Ícones, para abrir já com ela. */
  iconColor: string;
  /** Clicar num ícone mostra as variantes de cor antes de escolher. */
  askIconColor: boolean;
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
}

export const DEFAULT_SETTINGS: CoverlySettings = {
  askIconColor: false,
  colorPalette: "tailwind",
  coverFade: 0,
  coverHeight: 240,
  coverRadius: 0,
  coverShade: 35,
  customFonts: false,
  iconColor: "default",
  iconPosition: "above",
  language: "auto",
  linkPreview: true,
  nameColors: false,
  noteAccents: false,
  noteBackgrounds: false,
  recentEmojis: [],
  toc: true,
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
  | "colorPalette"
  | "iconPosition"
  | "treeIconPosition"
  | "twemoji"
  | "toc"
  | "linkPreview"
  | "nameColors"
  | "noteAccents"
  | "noteBackgrounds";

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
        ],
        type: "group",
      },
      {
        heading: t("settings.section.icons"),
        items: [
          {
            ...named("iconPosition"),
            control: {
              key: "iconPosition",
              options: {
                above: t("settings.iconPosition.above"),
                inline: t("settings.iconPosition.inline"),
              },
              type: "dropdown",
            },
          },
          {
            ...named("treeIconPosition"),
            control: {
              key: "treeIconPosition",
              options: {
                indent: t("settings.treeIconPosition.indent"),
                inline: t("settings.treeIconPosition.inline"),
              },
              type: "dropdown",
            },
          },
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
          { ...named("twemoji"), control: { key: "twemoji", type: "toggle" } },
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
        ],
        type: "group",
      },
    ];
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as ControlKey];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    await this.applyChange(key as ControlKey, value);
  }

  private async applyChange(key: ControlKey, value: unknown): Promise<void> {
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
    } else if (key === "treeIconPosition") {
      settings.treeIconPosition = value as TreeIconPosition;
      plugin.applyCoverStyle();
    } else if (key === "linkPreview") {
      settings.linkPreview = value as boolean;
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
