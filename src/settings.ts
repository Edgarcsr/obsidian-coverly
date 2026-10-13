import type { App } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";

import type MdPlusPlugin from "./main";

export interface MdPlusSettings {
  unsplashKey: string;
  coverHeight: number;
}

export const DEFAULT_SETTINGS: MdPlusSettings = {
  coverHeight: 240,
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
            this.plugin.applyCoverHeight();
            await this.plugin.saveSettings();
          })
      );
  }
}
