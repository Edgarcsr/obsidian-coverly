import type { App } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";

import type MdPlusPlugin from "./main";

export interface MdPlusSettings {
  unsplashKey: string;
  coverHeight: number;
  /** Raio dos cantos da capa, em pixels. 0 = cantos retos. */
  coverRadius: number;
  /** Quanto da altura da capa, de baixo para cima, some em degradê. 0 = sem degradê. */
  coverFade: number;
  /** Esconde o painel de propriedades em todas as notas. */
  hideProperties: boolean;
}

export const DEFAULT_SETTINGS: MdPlusSettings = {
  coverFade: 0,
  coverHeight: 240,
  coverRadius: 0,
  hideProperties: false,
  unsplashKey: "",
};

export class MdPlusSettingTab extends PluginSettingTab {
  private readonly plugin: MdPlusPlugin;

  constructor(app: App, plugin: MdPlusPlugin) {
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
      .setName("Ocultar propriedades")
      .setDesc(
        "Esconde o painel de propriedades no topo de todas as notas, não só das que têm capa."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hideProperties)
          .onChange(async (value) => {
            this.plugin.settings.hideProperties = value;
            this.plugin.applyCoverStyle();
            await this.plugin.saveSettings();
          })
      );
  }
}
