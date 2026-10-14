import type { App } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";

import type CoverlyPlugin from "./main";

export interface CoverlySettings {
  unsplashKey: string;
  coverHeight: number;
  /** Raio dos cantos da capa, em pixels. 0 = cantos retos. */
  coverRadius: number;
  /** Quanto da altura da capa, de baixo para cima, some em degradê. 0 = sem degradê. */
  coverFade: number;
  /** Quanto da altura da capa, de baixo para cima, escurece em degradê preto. 0 = sem sombra. */
  coverShade: number;
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
}

export const DEFAULT_SETTINGS: CoverlySettings = {
  askIconColor: false,
  coverFade: 0,
  coverHeight: 240,
  coverRadius: 0,
  coverShade: 0,
  iconColor: "default",
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
      .setName("Chave de acesso do Unsplash")
      .setDesc(
        "Access Key da sua aplicação em unsplash.com/developers. Necessária apenas para a aba Unsplash."
      )
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("Cole a Access Key")
          .setValue(this.plugin.settings.unsplashKey)
          .onChange(async (value) => {
            this.plugin.settings.unsplashKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Altura da capa")
      .setDesc("Altura padrão da capa em pixels.")
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
      .setName("Cantos arredondados")
      .setDesc("Raio dos cantos da capa em pixels. Zero deixa os cantos retos.")
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
      .setName("Degradê na parte de baixo")
      .setDesc(
        "Quanto da capa, de baixo para cima, some em degradê até a nota. Zero desliga o efeito."
      )
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
      .setName("Sombra na parte de baixo")
      .setDesc(
        "Quanto da capa, de baixo para cima, escurece em degradê preto. Destaca o ícone e o crédito sobre imagens claras. Zero desliga o efeito."
      )
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
      .setName("Emojis no estilo do X")
      .setDesc(
        "Desenha os emojis com o Twemoji. As imagens são baixadas do jsDelivr (cdn.jsdelivr.net) quando aparecem; nada da nota é enviado. Desligado, usa os emojis do sistema."
      )
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
      .setName("Sumário na lateral")
      .setDesc(
        "Mostra um traço por título na borda direita da nota, com a seção atual em destaque. Passe o mouse para ver os títulos e clique para ir até um deles."
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.toc).onChange(async (value) => {
          this.plugin.settings.toc = value;
          this.plugin.refreshHeaders();
          await this.plugin.saveSettings();
        })
      );
  }
}
