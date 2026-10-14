import type { App } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";

import { setLanguage, t } from "./i18n";
import type { Language } from "./i18n";
import type CoverlyPlugin from "./main";
import { setColorPalette } from "./page-icon";
import type { ColorPalette } from "./page-icon";

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
  coverShade: 0,
  iconColor: "default",
  language: "auto",
  linkPreview: true,
  recentEmojis: [],
  toc: true,
  twemoji: true,
  unsplashKey: "",
};

export class CoverlySettingTab extends PluginSettingTab {
  private readonly plugin: CoverlyPlugin;

  constructor(app: App, plugin: CoverlyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(t("settings.language.name"))
      .setDesc(t("settings.language.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", t("settings.language.auto"))
          .addOption("pt", "Português")
          .addOption("en", "English")
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as Language;
            setLanguage(this.plugin.settings.language);
            this.plugin.refreshHeaders();
            await this.plugin.saveSettings();
            // Redesenha esta tela já no novo idioma.
            this.display();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.unsplashKey.name"))
      .setDesc(t("settings.unsplashKey.desc"))
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder(t("settings.unsplashKey.placeholder"))
          .setValue(this.plugin.settings.unsplashKey)
          .onChange(async (value) => {
            this.plugin.settings.unsplashKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t("settings.coverHeight.name"))
      .setDesc(t("settings.coverHeight.desc"))
      .addSlider((slider) =>
        slider
          .setLimits(120, 400, 10)
          .setValue(this.plugin.settings.coverHeight)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.coverHeight = value;
            this.plugin.applyCoverStyle();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.coverRadius.name"))
      .setDesc(t("settings.coverRadius.desc"))
      .addSlider((slider) =>
        slider
          .setLimits(0, 40, 2)
          .setValue(this.plugin.settings.coverRadius)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.coverRadius = value;
            this.plugin.applyCoverStyle();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.coverFade.name"))
      .setDesc(t("settings.coverFade.desc"))
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 5)
          .setValue(this.plugin.settings.coverFade)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.coverFade = value;
            this.plugin.applyCoverStyle();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.coverShade.name"))
      .setDesc(t("settings.coverShade.desc"))
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 5)
          .setValue(this.plugin.settings.coverShade)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.coverShade = value;
            this.plugin.applyCoverStyle();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.colorPalette.name"))
      .setDesc(t("settings.colorPalette.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("tailwind", t("settings.colorPalette.tailwind"))
          .addOption("notion", t("settings.colorPalette.notion"))
          .setValue(this.plugin.settings.colorPalette)
          .onChange(async (value) => {
            this.plugin.settings.colorPalette = value as ColorPalette;
            setColorPalette(this.plugin.settings.colorPalette);
            this.plugin.refreshHeaders();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.twemoji.name"))
      .setDesc(t("settings.twemoji.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.twemoji)
          .onChange(async (value) => {
            this.plugin.settings.twemoji = value;
            this.plugin.refreshHeaders();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.toc.name"))
      .setDesc(t("settings.toc.desc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.toc).onChange(async (value) => {
          this.plugin.settings.toc = value;
          this.plugin.refreshHeaders();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t("settings.linkPreview.name"))
      .setDesc(t("settings.linkPreview.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.linkPreview)
          .onChange(async (value) => {
            this.plugin.settings.linkPreview = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
