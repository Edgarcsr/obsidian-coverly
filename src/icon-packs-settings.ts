import { Notice, setTooltip } from "obsidian";
import type { Setting, SettingDefinitionRender } from "obsidian";

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

/** Ícones do Lucide mostrados na linha dele; o Obsidian já os traz. */
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

/** O que a linha mostra de um pacote; o Lucide não tem como instalar. */
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

/** Estado do pacote, no começo da descrição: incluído, não instalado ou o tamanho. */
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
 * Faixa com alguns ícones do pacote, para ver o estilo antes de instalar. Os
 * de uma cor só usam a cor do texto, como no seletor; os coloridos, as deles.
 * Os exemplos vêm embutidos, e o resto do pacote só depois de instalado.
 */
const renderPreview = (parent: HTMLElement, view: PackView): void => {
  const strip = parent.createDiv({ cls: "mdp-pack-preview" });
  if (!view.info) {
    for (const name of LUCIDE_SAMPLES) {
      drawLucide(strip.createDiv({ cls: "mdp-pack-preview-icon" }), name);
    }
    return;
  }
  for (const [name, svg] of sampleIcons[view.id] ?? []) {
    const cell = strip.createDiv({
      attr: { "aria-label": name },
      cls: "mdp-pack-preview-icon",
    });
    if (view.info.tintable) {
      cell
        .createSpan({ cls: "mdp-pack-icon" })
        .style.setProperty("--mdp-pack-icon", `url("${svgUrl(svg)}")`);
    } else {
      cell.createEl("img", { attr: { alt: "", src: svgUrl(svg) } });
    }
  }
};

/** Chave de mostrar o pacote como sub-aba no seletor de ícones. */
const addVisibility = (
  setting: Setting,
  plugin: CoverlyPlugin,
  id: string
): void => {
  setting.addToggle((toggle) => {
    setTooltip(toggle.toggleEl, t("settings.iconPacks.visibleDesc"));
    toggle.setValue(!plugin.settings.hiddenIconPacks.includes(id)).onChange(
      asyncListener(async (visible: boolean) => {
        const others = plugin.settings.hiddenIconPacks.filter(
          (hidden) => hidden !== id
        );
        plugin.settings.hiddenIconPacks = visible ? others : [...others, id];
        await plugin.saveSettings();
      })
    );
  });
};

/** Baixar, com o progresso no botão. Refaz a linha quando termina. */
const addInstall = (
  setting: Setting,
  plugin: CoverlyPlugin,
  info: IconPackInfo,
  redraw: () => void
): void => {
  setting.addButton((button) => {
    setTooltip(
      button.buttonEl,
      t("settings.iconPacks.available", { size: formatSize(info.approxBytes) })
    );
    button
      .setButtonText(t("settings.iconPacks.install"))
      .setCta()
      .onClick(
        asyncListener(async () => {
          button.setDisabled(true);
          button.setButtonText(t("settings.iconPacks.downloading"));
          try {
            await installPack(plugin.app, info.id, (done, total) => {
              button.setButtonText(`${done}/${total}`);
            });
          } catch (error) {
            console.error(error);
            notify(t("notice.iconPackFailed", { name: info.name }));
          }
          redraw();
        })
      );
  });
};

/** Apaga a cópia do pacote no vault. */
const addRemove = (
  setting: Setting,
  plugin: CoverlyPlugin,
  info: IconPackInfo,
  redraw: () => void
): void => {
  setting.addButton((button) => {
    button
      .setButtonText(t("settings.iconPacks.remove"))
      .setWarning()
      .onClick(
        asyncListener(async () => {
          button.setDisabled(true);
          await removePack(plugin.app, info.id);
          redraw();
        })
      );
  });
};

/**
 * Uma linha por pacote, direto na página de configurações: o nome, o estado
 * e a descrição, os exemplos embaixo e os controles à direita. Instalar ou
 * remover refaz só esta linha.
 */
const renderPackRow = (
  setting: Setting,
  plugin: CoverlyPlugin,
  view: PackView
): void => {
  const draw = (): void => {
    setting.controlEl.empty();
    setting.setDesc(`${stateLabel(view)} · ${view.desc}`);
    renderPreview(setting.descEl, view);

    setting.addExtraButton((button) => {
      button
        .setIcon("external-link")
        .setTooltip(view.homepage)
        .onClick(() => {
          window.open(view.homepage);
        });
    });
    const { info } = view;
    if (!info) {
      addVisibility(setting, plugin, view.id);
    } else if (installedSize(view.id) === undefined) {
      addInstall(setting, plugin, info, draw);
    } else {
      addVisibility(setting, plugin, view.id);
      addRemove(setting, plugin, info, draw);
    }
  };
  draw();
};

/**
 * Pacotes de ícones na página de configurações. O Lucide vem com o
 * Obsidian; os do catálogo são baixados só quando a pessoa pede.
 */
export const iconPackItems = (
  plugin: CoverlyPlugin
): SettingDefinitionRender[] =>
  views().map((view): SettingDefinitionRender => ({
    name: view.name,
    render: (setting) => {
      renderPackRow(setting, plugin, view);
    },
  }));
