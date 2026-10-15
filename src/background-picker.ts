import { setIcon } from "obsidian";

import { asyncListener } from "./async-listener";
import { GRADIENTS } from "./gallery";
import { t } from "./i18n";
import type CoverlyPlugin from "./main";
import { isHexColor } from "./note-data";
import { TabbedPopover } from "./popover";
import type { PopoverTab } from "./popover";
import { renderUploadTab } from "./upload-tab";

type Tab = "colors" | "upload" | "link";

const URL_PATTERN = /^https?:\/\//u;

const tabs = (): PopoverTab<Tab>[] => [
  { id: "colors", label: t("tab.colors") },
  { id: "upload", label: t("tab.upload") },
  { id: "link", label: t("tab.link") },
];

export interface BackgroundPickerOptions {
  plugin: CoverlyPlugin;
  /** Nota que recebe a imagem enviada como anexo. */
  sourcePath: string;
  /** Botão que abriu o seletor; sem ele o popover abre centralizado. */
  anchor: HTMLElement | null;
  /** Fundo atual da nota, para marcar o selecionado e mostrar "Remover". */
  current: string | undefined;
  onPick: (value: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

/** Seletor de fundo da nota: cores e gradientes, imagem enviada ou do vault, ou link. */
export class BackgroundPicker extends TabbedPopover<Tab> {
  private readonly options: BackgroundPickerOptions;
  private current: string | undefined;

  constructor(options: BackgroundPickerOptions) {
    super(options.anchor, tabs(), "colors", "mdp-cover-picker");
    this.options = options;
    this.current = options.current;
  }

  protected hasRemove(): boolean {
    return Boolean(this.current);
  }

  protected async remove(): Promise<void> {
    await this.options.onRemove();
  }

  protected renderTab(tab: Tab): void {
    // Só a aba de cores é estreita; as outras usam a largura cheia.
    this.el.toggleClass("is-compact", tab === "colors");
    switch (tab) {
      case "colors": {
        this.renderColors();
        break;
      }
      case "upload": {
        renderUploadTab(this.body, {
          app: this.options.plugin.app,
          current: this.current,
          pick: async (path) => {
            await this.choose(path);
            this.close();
          },
          sourcePath: this.options.sourcePath,
        });
        break;
      }
      case "link": {
        this.renderLink();
        break;
      }
      default: {
        break;
      }
    }
  }

  private renderColors(): void {
    this.body.createDiv({
      cls: "mdp-picker-section-title",
      text: t("gallery.colorsAndGradients"),
    });
    const grid = this.body.createDiv({ cls: "mdp-picker-grid is-squares" });
    for (const preset of GRADIENTS) {
      const value = `gradient:${preset.id}`;
      const label = t(preset.name);
      const tile = grid.createEl("button", {
        attr: { "aria-label": label, title: label },
        cls:
          value === this.current
            ? "mdp-picker-tile is-selected"
            : "mdp-picker-tile",
      });
      tile.style.backgroundImage = preset.css;
      tile.addEventListener(
        "click",
        asyncListener(async () => {
          await this.choose(value);
          for (const other of this.body.querySelectorAll(".is-selected")) {
            other.removeClass("is-selected");
          }
          tile.addClass("is-selected");
        })
      );
    }

    this.renderCustomColor(grid);
  }

  /** Último quadrado: abre o seletor de cores do sistema para qualquer cor. */
  private renderCustomColor(grid: HTMLElement): void {
    const custom = grid.createEl("button", {
      attr: { "aria-label": t("color.custom"), title: t("color.custom") },
      cls: "mdp-picker-tile is-custom",
    });
    setIcon(custom.createSpan({ cls: "mdp-picker-tile-icon" }), "plus");
    const input = custom.createEl("input", {
      cls: "mdp-color-input",
      type: "color",
    });
    const showColor = (hex: string): void => {
      custom.style.backgroundImage = `linear-gradient(${hex}, ${hex})`;
    };
    if (this.current && isHexColor(this.current)) {
      input.value = this.current;
      showColor(this.current);
      custom.addClass("is-selected");
    }

    custom.addEventListener("click", () => {
      input.click();
    });
    input.addEventListener(
      "change",
      asyncListener(async () => {
        showColor(input.value);
        await this.choose(input.value);
        for (const other of this.body.querySelectorAll(".is-selected")) {
          other.removeClass("is-selected");
        }
        custom.addClass("is-selected");
      })
    );
  }

  private renderLink(): void {
    const form = this.body.createDiv({ cls: "mdp-picker-link" });
    const input = form.createEl("input", {
      cls: "mdp-picker-input",
      placeholder: t("cover.linkPlaceholder"),
      type: "url",
    });
    const submit = form.createEl("button", {
      cls: "mdp-picker-primary is-accent",
      text: t("cover.linkSubmit"),
    });
    form.createDiv({ cls: "mdp-picker-hint", text: t("cover.linkHint") });
    submit.disabled = true;

    const send = async (): Promise<void> => {
      const url = input.value.trim();
      if (URL_PATTERN.test(url)) {
        await this.choose(url);
        this.close();
      }
    };

    input.addEventListener("input", () => {
      submit.disabled = !URL_PATTERN.test(input.value.trim());
    });
    input.addEventListener(
      "keydown",
      asyncListener(async (event) => {
        if (event.key === "Enter") {
          await send();
        }
      })
    );
    submit.addEventListener("click", asyncListener(send));
    input.focus();
  }

  /** Aplica o fundo e passa a mostrar "Remover", já que agora existe um. */
  private async choose(value: string): Promise<void> {
    await this.options.onPick(value);
    const hadBackground = Boolean(this.current);
    this.current = value;
    if (!hadBackground) {
      this.renderTabs();
    }
  }
}
