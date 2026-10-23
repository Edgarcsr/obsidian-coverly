import { Notice, Setting, SettingPage } from "obsidian";
import type { SettingDefinitionPage } from "obsidian";

import { asyncListener } from "./async-listener";
import { t } from "./i18n";
import type { MessageKey } from "./i18n";
import { ICON_PACKS } from "./icon-pack-catalog";
import type { IconPackInfo } from "./icon-pack-catalog";
import samples from "./icon-pack-samples.json";
import { installPack, installedSize, removePack } from "./icon-packs";
import { LUCIDE_PACK } from "./icon-picker";
import type CoverlyPlugin from "./main";
import { drawLucide } from "./page-icon";
import { formatSize } from "./storage";

const LUCIDE_HOMEPAGE = "https://lucide.dev";

/** Ícones do Lucide mostrados na página dele; o Obsidian já os traz. */
const LUCIDE_SAMPLES = [
  "house",
  "folder",
  "file-text",
  "book-open",
  "star",
  "heart",
  "bookmark",
  "calendar",
  "lightbulb",
  "code",
  "image",
  "settings",
];

const sampleIcons = samples as unknown as Record<string, [string, string][]>;

const svgUrl = (svg: string): string =>
  `data:image/svg+xml,${encodeURIComponent(svg)}`;

const notify = (message: string): Notice => new Notice(message);

/** O que a subpágina mostra de um pacote; o Lucide não tem como instalar. */
interface PackView {
  id: string;
  name: string;
  desc: string;
  homepage: string;
  /** Do catálogo; `undefined` no Lucide, que já vem com o Obsidian. */
  info?: IconPackInfo;
}

const DESCRIPTIONS: Record<string, MessageKey> = {
  phosphor: "settings.iconPacks.desc.phosphor",
  symbols: "settings.iconPacks.desc.symbols",
  tabler: "settings.iconPacks.desc.tabler",
};

const views = (): PackView[] => [
  {
    desc: t("settings.iconPacks.lucide"),
    homepage: LUCIDE_HOMEPAGE,
    id: LUCIDE_PACK,
    name: "Lucide",
  },
  ...ICON_PACKS.map((info): PackView => ({
    desc: t(DESCRIPTIONS[info.id] ?? "settings.iconPacks.lucide"),
    homepage: info.homepage,
    id: info.id,
    info,
    name: info.name,
  })),
];

/** Estado curto mostrado na linha da lista, à direita do nome. */
const stateLabel = (view: PackView): string => {
  if (!view.info) {
    return t("settings.iconPacks.builtIn");
  }
  const size = installedSize(view.id);
  return size === undefined
    ? t("settings.iconPacks.notInstalled")
    : formatSize(size);
};

/**
 * Página de um pacote: instalar ou remover, mostrar no seletor e a página do
 * projeto. Refaz a si mesma depois de instalar ou remover.
 */
class IconPackPage extends SettingPage {
  private readonly plugin: CoverlyPlugin;
  private readonly view: PackView;
  private readonly onChange: () => void;

  constructor(plugin: CoverlyPlugin, view: PackView, onChange: () => void) {
    super();
    this.plugin = plugin;
    this.view = view;
    this.onChange = onChange;
    this.title = view.name;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const { info } = this.view;

    new Setting(containerEl).setName(this.view.name).setDesc(this.view.desc);
    this.renderPreview(containerEl);

    if (info) {
      this.renderInstall(containerEl, info);
    }
    if (!info || installedSize(this.view.id) !== undefined) {
      this.renderVisibility(containerEl);
    }

    new Setting(containerEl)
      .setName(t("settings.iconPacks.website"))
      .setDesc(
        info ? `${info.license} · ${this.view.homepage}` : this.view.homepage
      )
      .addExtraButton((button) => {
        button.setIcon("external-link").onClick(() => {
          window.open(this.view.homepage);
        });
      });
  }

  /**
   * Faixa com alguns ícones do pacote, para ver o estilo antes de instalar.
   * Os de uma cor só usam a cor do texto, como no seletor; os coloridos, as
   * deles. Os exemplos vêm embutidos, e o resto do pacote só depois de
   * instalado.
   */
  private renderPreview(parent: HTMLElement): void {
    const strip = parent.createDiv({ cls: "mdp-pack-preview" });
    if (!this.view.info) {
      for (const name of LUCIDE_SAMPLES) {
        drawLucide(strip.createDiv({ cls: "mdp-pack-preview-icon" }), name);
      }
      return;
    }
    const { tintable } = this.view.info;
    for (const [name, svg] of sampleIcons[this.view.id] ?? []) {
      const cell = strip.createDiv({
        attr: { "aria-label": name },
        cls: "mdp-pack-preview-icon",
      });
      if (tintable) {
        cell
          .createSpan({ cls: "mdp-pack-icon" })
          .style.setProperty("--mdp-pack-icon", `url("${svgUrl(svg)}")`);
      } else {
        cell.createEl("img", { attr: { alt: "", src: svgUrl(svg) } });
      }
    }
  }

  /** Baixar com o progresso no botão, ou apagar o que já foi baixado. */
  private renderInstall(parent: HTMLElement, info: IconPackInfo): void {
    const { app } = this.plugin;
    const size = installedSize(info.id);
    const row = new Setting(parent);
    if (size === undefined) {
      row
        .setName(t("settings.iconPacks.notInstalled"))
        .setDesc(
          t("settings.iconPacks.available", {
            size: formatSize(info.approxBytes),
          })
        )
        .addButton((button) => {
          button
            .setButtonText(t("settings.iconPacks.install"))
            .setCta()
            .onClick(
              asyncListener(async () => {
                button.setDisabled(true);
                button.setButtonText(t("settings.iconPacks.downloading"));
                try {
                  await installPack(app, info.id, (done, total) => {
                    button.setButtonText(`${done}/${total}`);
                  });
                } catch (error) {
                  console.error(error);
                  notify(t("notice.iconPackFailed", { name: info.name }));
                }
                this.display();
                this.onChange();
              })
            );
        });
      return;
    }
    row
      .setName(t("settings.iconPacks.installedName"))
      .setDesc(
        t("settings.iconPacks.installed", {
          size: formatSize(size),
        })
      )
      .addButton((button) => {
        button
          .setButtonText(t("settings.iconPacks.remove"))
          .setWarning()
          .onClick(
            asyncListener(async () => {
              button.setDisabled(true);
              await removePack(app, info.id);
              this.display();
              this.onChange();
            })
          );
      });
  }

  /** Chave de mostrar o pacote como sub-aba no seletor de ícones. */
  private renderVisibility(parent: HTMLElement): void {
    const { plugin } = this;
    const { id } = this.view;
    new Setting(parent)
      .setName(t("settings.iconPacks.visible"))
      .setDesc(t("settings.iconPacks.visibleDesc"))
      .addToggle((toggle) => {
        toggle.setValue(!plugin.settings.hiddenIconPacks.includes(id)).onChange(
          asyncListener(async (visible: boolean) => {
            const others = plugin.settings.hiddenIconPacks.filter(
              (hidden) => hidden !== id
            );
            plugin.settings.hiddenIconPacks = visible
              ? others
              : [...others, id];
            await plugin.saveSettings();
          })
        );
      });
  }
}

/**
 * Pacotes de ícones como uma lista de linhas com seta, a do Importador do
 * Obsidian: o nome, o estado (incluído, não instalado ou o tamanho) e uma
 * página para cada um. O Lucide vem com o Obsidian; os do catálogo são
 * baixados só quando a pessoa pede.
 */
export const iconPackItems = (
  plugin: CoverlyPlugin,
  rerender: () => void
): SettingDefinitionPage[] =>
  views().map((view): SettingDefinitionPage => ({
    desc: view.desc,
    displayValue: () => stateLabel(view),
    name: view.name,
    page: () => new IconPackPage(plugin, view, rerender),
    type: "page",
  }));
