import { asyncListener } from "./async-listener";
import { GRADIENTS } from "./gallery";
import { t } from "./i18n";
import type CoverlyPlugin from "./main";
import { TabbedPopover } from "./popover";
import type { PopoverTab } from "./popover";
import { renderVaultImages } from "./vault-images";

type Tab = "colors" | "vault" | "link";

const URL_PATTERN = /^https?:\/\//u;

const tabs = (): PopoverTab<Tab>[] => [
  { id: "colors", label: t("tab.colors") },
  { id: "vault", label: t("tab.vault") },
  { id: "link", label: t("tab.link") },
];

export interface BackgroundPickerOptions {
  plugin: CoverlyPlugin;
  /** Botão que abriu o seletor; sem ele o popover abre centralizado. */
  anchor: HTMLElement | null;
  /** Fundo atual da nota, para marcar o selecionado e mostrar "Remover". */
  current: string | undefined;
  onPick: (value: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

/** Seletor de fundo da nota: cores e gradientes, imagem do vault ou link. */
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
    switch (tab) {
      case "colors": {
        this.renderColors();
        break;
      }
      case "vault": {
        renderVaultImages(this.body, {
          app: this.options.plugin.app,
          current: this.current,
          pick: async (path) => {
            await this.choose(path);
            this.close();
          },
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
    const grid = this.body.createDiv({ cls: "mdp-picker-grid" });
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
