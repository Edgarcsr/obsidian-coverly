import { getIconIds, setIcon, setTooltip } from "obsidian";
import type { App } from "obsidian";

import { renderColorButton, showColorVariants } from "./color-palette";
import type { ColorState } from "./color-palette";
import { EmojiGrid } from "./emoji-grid";
import { emojiGroups } from "./emojis";
import type { EmojiEntry, EmojiGroup } from "./emojis";
import { t } from "./i18n";
import { renderIconUpload } from "./icon-upload";
import type { IconUploadHandle } from "./icon-upload";
import { normalize, searchLucide } from "./lucide-search";
import {
  drawLucide,
  isImageIcon,
  lucideNames,
  lucideValue,
  parseLucide,
} from "./page-icon";
import { TabbedPopover, searchField } from "./popover";
import type { PopoverTab } from "./popover";
import { drawEmoji } from "./twemoji";

type Tab = "emoji" | "icons" | "upload";

const tabs = (): PopoverTab<Tab>[] => [
  { id: "emoji", label: t("tab.emoji") },
  { id: "icons", label: t("tab.icons") },
  { id: "upload", label: t("tab.uploadIcon") },
];

/**
 * São mais de mil ícones Lucide; desenhar todos de uma vez trava a abertura.
 * A grade cresce em lotes conforme a rolagem chega ao fim.
 */
const BATCH = 120;

const randomItem = <T>(items: readonly T[]): T | undefined =>
  items[Math.floor(Math.random() * items.length)];

/** Botão de uma opção da grade; o conteúdo (emoji ou SVG) fica com quem chama. */
const optionButton = (
  grid: HTMLElement,
  label: string,
  selected: boolean,
  onClick: () => Promise<void>
): HTMLElement => {
  const button = grid.createEl("button", {
    attr: { "aria-label": label },
    cls: selected ? "mdp-icon-option is-selected" : "mdp-icon-option",
  });
  button.addEventListener("click", onClick);
  return button;
};

/** Uma seção da aba Emoji, também usada como botão da barra de categorias. */
interface EmojiSection {
  name: string;
  icon: string;
  emojis: EmojiEntry[];
}

export interface IconPickerOptions {
  app: App;
  /** Nota dona do ícone; o upload vai para a pasta de anexos dela. */
  sourcePath: string;
  /** Botão que abriu o seletor; sem ele o popover abre centralizado. */
  anchor: HTMLElement | null;
  /** Ícone atual da nota, para marcar o selecionado e mostrar "Remover". */
  current: string | undefined;
  /** Cor com que a aba Ícones abre. */
  color: string;
  /** Clicar num ícone mostra as variantes de cor antes de escolher. */
  askColor: boolean;
  /** Emojis usados por último, para a seção Recentes. */
  recentEmojis: readonly string[];
  /** Desenha os emojis no estilo do X em vez do emoji do sistema. */
  twemoji: boolean;
  onPick: (value: string) => Promise<void>;
  onColorChange: (color: string) => Promise<void>;
  onAskColorChange: (askColor: boolean) => Promise<void>;
  onRemove: () => Promise<void>;
}

const initialTab = (app: App, current: string): Tab => {
  if (parseLucide(current) !== null) {
    return "icons";
  }
  return current && isImageIcon(app, current) ? "upload" : "emoji";
};

/** Seletor de ícone da página: emoji, ícone Lucide ou imagem, como no Notion. */
export class IconPicker extends TabbedPopover<Tab> {
  private readonly options: IconPickerOptions;
  private readonly colorState: ColorState;
  private closeVariants: (() => void) | null = null;
  private observer: IntersectionObserver | null = null;
  private upload: IconUploadHandle | null = null;
  private onBodyScroll: (() => void) | null = null;
  private grids: EmojiGrid[] = [];
  private readonly groups: EmojiGroup[] = emojiGroups();
  private readonly allEmojis: EmojiEntry[] = this.groups.flatMap(
    (group) => group.emojis
  );

  private readonly onPaste = (event: ClipboardEvent): void => {
    this.upload?.onPaste(event);
  };

  constructor(options: IconPickerOptions) {
    super(
      options.anchor,
      tabs(),
      initialTab(options.app, options.current ?? ""),
      "mdp-icon-picker"
    );
    this.options = options;
    this.colorState = { askColor: options.askColor, color: options.color };
  }

  override open(): void {
    super.open();
    document.addEventListener("paste", this.onPaste, true);
  }

  override close(): void {
    document.removeEventListener("paste", this.onPaste, true);
    this.resetTab();
    super.close();
  }

  protected hasRemove(): boolean {
    return Boolean(this.options.current);
  }

  protected async remove(): Promise<void> {
    await this.options.onRemove();
  }

  protected renderTab(tab: Tab): void {
    this.resetTab();
    switch (tab) {
      case "emoji": {
        this.renderEmoji();
        break;
      }
      case "icons": {
        this.renderIcons();
        break;
      }
      case "upload": {
        this.upload = renderIconUpload(this.body, {
          app: this.options.app,
          close: () => {
            this.close();
          },
          pick: async (value) => {
            await this.pick(value);
          },
          sourcePath: this.options.sourcePath,
        });
        break;
      }
      default: {
        break;
      }
    }
  }

  /** Desfaz o que a aba anterior deixou ligado. */
  private resetTab(): void {
    this.observer?.disconnect();
    this.observer = null;
    for (const grid of this.grids) {
      grid.destroy();
    }
    this.grids = [];
    this.upload?.dispose();
    this.upload = null;
    this.closeVariants?.();
    this.closeVariants = null;
    if (this.onBodyScroll) {
      this.body.removeEventListener("scroll", this.onBodyScroll);
      this.onBodyScroll = null;
    }
  }

  /** Linha fixa no topo: filtro e botão de escolher ao acaso. */
  private searchRow(
    placeholder: string,
    onRandom: () => void
  ): { row: HTMLElement; input: HTMLInputElement } {
    const row = this.body.createDiv({ cls: "mdp-picker-search is-row" });
    const input = searchField(row, placeholder);
    const random = row.createEl("button", { cls: "mdp-picker-square" });
    setIcon(random, "shuffle");
    setTooltip(random, t("iconPicker.random"));
    random.addEventListener("click", onRandom);
    return { input, row };
  }

  private emojiSections(): EmojiSection[] {
    const recent = this.options.recentEmojis
      .map((emoji) => this.allEmojis.find((entry) => entry.emoji === emoji))
      .filter((entry): entry is EmojiEntry => entry !== undefined);
    const sections: EmojiSection[] = [...this.groups];
    if (recent.length > 0) {
      sections.unshift({
        emojis: recent,
        icon: "clock",
        name: t("iconPicker.recent"),
      });
    }
    return sections;
  }

  private renderEmoji(): void {
    const sections = this.emojiSections();
    let visible = this.allEmojis;
    const { input, row } = this.searchRow(
      t("iconPicker.filterEmoji"),
      async () => {
        const entry = randomItem(visible);
        if (entry) {
          await this.pick(entry.emoji);
        }
      }
    );

    /*
     * Duas grades virtualizadas: a completa, montada uma vez e só oculta
     * durante a busca (ao voltar, as linhas já desenhadas reaparecem), e a dos
     * resultados, refeita a cada tecla. Cada uma só desenha o que está à vista.
     */
    const make = (rowEl: HTMLElement, entry: EmojiEntry): void => {
      this.emojiButton(rowEl, entry);
    };
    const full = new EmojiGrid(this.body, this.body, make);
    full.setSections(
      sections.map((section) => ({
        entries: section.emojis,
        title: section.name,
      }))
    );
    const results = new EmojiGrid(this.body, this.body, make);
    const empty = this.body.createDiv({
      cls: "mdp-picker-hint is-empty",
      text: t("iconPicker.noEmoji"),
    });
    this.grids = [full, results];
    let searching = false;

    let buttons: HTMLElement[] = [];

    // Marca na barra a seção que está no topo da rolagem.
    const highlight = (): void => {
      const top = this.body.scrollTop + row.offsetHeight + 4;
      const tops = searching ? [] : full.sectionTops();
      let active = 0;
      for (const [index, sectionTop] of tops.entries()) {
        if (sectionTop <= top) {
          active = index;
        }
      }
      for (const [index, button] of buttons.entries()) {
        button.toggleClass("is-active", tops.length > 1 && index === active);
      }
    };

    const filter = (): void => {
      const query = normalize(input.value);
      searching = Boolean(query);
      visible = searching
        ? this.allEmojis.filter((entry) =>
            normalize(entry.keywords).includes(query)
          )
        : this.allEmojis;
      full.toggle(!searching);
      results.toggle(searching && visible.length > 0);
      empty.toggle(searching && visible.length === 0);
      if (searching) {
        results.setSections([
          { entries: visible, title: t("iconPicker.results") },
        ]);
      }
      highlight();
    };

    // Barra de categorias no rodapé: cada botão rola até a sua seção.
    this.footer.show();
    const bar = this.footer.createDiv({ cls: "mdp-emoji-bar" });
    buttons = sections.map((section, index) => {
      const button = bar.createEl("button", { cls: "mdp-emoji-bar-btn" });
      setIcon(button, section.icon);
      setTooltip(button, section.name, { placement: "top" });
      button.addEventListener("click", () => {
        if (input.value) {
          input.value = "";
          filter();
        }
        const sectionTop = full.sectionTops()[index];
        if (sectionTop !== undefined) {
          this.body.scrollTop = sectionTop - row.offsetHeight;
        }
      });
      return button;
    });

    const onScroll = (): void => {
      (searching ? results : full).update();
      highlight();
    };
    this.onBodyScroll = onScroll;
    this.body.addEventListener("scroll", onScroll, { passive: true });
    input.addEventListener("input", filter);
    filter();
    input.focus();
  }

  /** Botão de um emoji, com o nome dele na dica. */
  private emojiButton(grid: HTMLElement, entry: EmojiEntry): HTMLElement {
    const button = optionButton(
      grid,
      entry.name,
      entry.emoji === this.options.current,
      async () => {
        await this.pick(entry.emoji);
      }
    );
    drawEmoji(button, entry.emoji, this.options.twemoji);
    return button;
  }

  private renderIcons(): void {
    const all = lucideNames(getIconIds());
    const selected = parseLucide(this.options.current ?? "")?.name;
    let matches = all;
    let shown = 0;

    const { input, row } = this.searchRow(
      t("iconPicker.filterIcons"),
      async () => {
        const name = randomItem(matches);
        if (name) {
          await this.pick(lucideValue(name, this.colorState.color));
        }
      }
    );
    this.body.createDiv({
      cls: "mdp-picker-section-title",
      text: t("tab.icons"),
    });
    const grid = this.body.createDiv({ cls: "mdp-icon-grid is-lucide" });
    renderColorButton({
      grid,
      onAskColorChange: this.options.onAskColorChange,
      onColorChange: this.options.onColorChange,
      row,
      state: this.colorState,
    });
    const status = this.body.createDiv({
      cls: "mdp-picker-hint is-empty",
      text: t("iconPicker.noIcons"),
    });
    const sentinel = this.body.createDiv({ cls: "mdp-icon-sentinel" });

    const more = (): void => {
      const next = matches.slice(shown, shown + BATCH);
      for (const name of next) {
        const button = optionButton(grid, name, name === selected, async () => {
          await this.pickIcon(button, name);
        });
        drawLucide(button, name);
      }
      shown += next.length;
      // O observer só avisa quando a visibilidade do sentinela muda. Se ele
      // continuou à vista (ex.: o filtro foi apagado), não haveria novo aviso
      // e a grade pararia no primeiro lote; observar de novo força um aviso.
      if (this.observer && next.length > 0) {
        this.observer.unobserve(sentinel);
        this.observer.observe(sentinel);
      }
    };

    const filter = (): void => {
      // Nome, tags e categorias, como no lucide.dev: "money" acha "banknote".
      matches = searchLucide(all, input.value);
      this.closeVariants?.();
      grid.empty();
      shown = 0;
      status.toggle(matches.length === 0);
      more();
    };

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          more();
        }
      },
      { root: this.body, rootMargin: "200px" }
    );
    this.observer.observe(sentinel);

    input.addEventListener("input", filter);
    filter();
    input.focus();
  }

  /** Com "Perguntar sempre", mostra o ícone nas cores; senão, usa a cor atual. */
  private async pickIcon(button: HTMLElement, name: string): Promise<void> {
    if (!this.colorState.askColor) {
      await this.pick(lucideValue(name, this.colorState.color));
      return;
    }
    this.closeVariants?.();
    this.closeVariants = showColorVariants(
      this.body,
      button,
      name,
      this.colorState,
      async (color) => {
        await this.pick(lucideValue(name, color));
      }
    );
  }

  private async pick(value: string): Promise<void> {
    this.close();
    await this.options.onPick(value);
  }
}
