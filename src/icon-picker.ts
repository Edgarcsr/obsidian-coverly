import { getIconIds, setIcon, setTooltip } from "obsidian";
import type { App } from "obsidian";

import { asyncListener } from "./async-listener";
import { renderColorButton, showColorVariants } from "./color-palette";
import type { ColorState } from "./color-palette";
import { EmojiGrid } from "./emoji-grid";
import { emojiGroups } from "./emojis";
import type { EmojiEntry, EmojiGroup } from "./emojis";
import { t } from "./i18n";
import {
  loadPack,
  packIconValue,
  packNames,
  parsePackIcon,
  searchPack,
} from "./icon-packs";
import { renderIconUpload } from "./icon-upload";
import type { IconUploadHandle } from "./icon-upload";
import { imageUsage, releaseImage } from "./image-usage";
import { normalize, searchLucide } from "./lucide-search";
import {
  DEFAULT_ICON_COLOR,
  drawLucide,
  drawPackIcon,
  lucideNames,
  lucideValue,
  parseLucide,
} from "./page-icon";
import { measure } from "./perf";
import { renderSavedImages } from "./plugin-images";
import { TabbedPopover, searchField } from "./popover";
import type { PopoverTab } from "./popover";
import { drawEmoji } from "./twemoji";
import { renderVaultImages } from "./vault-images";

export type Tab = "emoji" | "icons" | "upload";

const tabs = (): PopoverTab<Tab>[] => [
  { id: "emoji", label: t("tab.emoji") },
  { id: "icons", label: t("tab.icons") },
  { id: "upload", label: t("tab.upload") },
];

/** Id da sub-aba do Lucide, que vem com o Obsidian. */
export const LUCIDE_PACK = "lucide";

/** Uma sub-aba da aba Ícones: o Lucide ou um pacote instalado. */
export interface PickerPack {
  id: string;
  name: string;
  /** Uma cor só: a grade mostra o botão de cor. */
  tintable: boolean;
}

/** Busca, desenho e valor gravado dos ícones de um pacote. */
interface IconSource {
  search: (query: string) => readonly string[];
  draw: (el: HTMLElement, name: string) => void;
  value: (name: string, color: string) => string;
  /** Nome do ícone atual, se ele for deste pacote. */
  selected: string | undefined;
  tintable: boolean;
}

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
  button.addEventListener("click", asyncListener(onClick));
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
  /** Aba em que o seletor abre (a última usada). */
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  /** Sub-abas da aba Ícones, o Lucide primeiro. */
  packs: readonly PickerPack[];
  /** Sub-aba em que a aba Ícones abre (a última usada). */
  pack: string;
  onPackChange: (pack: string) => void;
  onPick: (value: string) => Promise<void>;
  onColorChange: (color: string) => Promise<void>;
  onAskColorChange: (askColor: boolean) => Promise<void>;
  onRemove: () => Promise<void>;
}

/** Seletor de ícone da página: emoji, ícone Lucide, de pacote ou imagem, como no Notion. */
export class IconPicker extends TabbedPopover<Tab> {
  private readonly options: IconPickerOptions;
  private readonly colorState: ColorState;
  /** Sub-aba da aba Ícones à vista; vale ao voltar de outra aba. */
  private packId: string;
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
    super(options.anchor, tabs(), options.tab, "mdp-icon-picker");
    this.options = options;
    this.colorState = { askColor: options.askColor, color: options.color };
    this.packId = options.pack;
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

  protected override onTabChange(tab: Tab): void {
    this.options.onTabChange(tab);
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
          pick: async (value) => {
            await this.pick(value);
          },
          renderExtra: (parent) => {
            void renderSavedImages(parent.createDiv(), {
              app: this.options.app,
              current: this.options.current,
              kind: "icons",
              pick: async (path) => {
                await this.pick(path);
              },
              release: (path) => releaseImage(this.options.app, path),
              usage: (path) => imageUsage(this.options.app, path),
            });
            parent.createDiv({
              cls: "mdp-picker-section-title",
              text: t("vault.title"),
            });
            renderVaultImages(parent, {
              app: this.options.app,
              current: this.options.current,
              pick: async (path) => {
                await this.pick(path);
              },
              square: true,
            });
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
      asyncListener(async () => {
        const entry = randomItem(visible);
        if (entry) {
          await this.pick(entry.emoji);
        }
      })
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
        ? measure("picker.emojiFilter", () =>
            this.allEmojis.filter((entry) => entry.keywords.includes(query))
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

  /** Como a grade lida com os ícones de um pacote: o Lucide ou um instalado. */
  private iconSource(pack: PickerPack): IconSource {
    const current = this.options.current ?? "";
    if (pack.id === LUCIDE_PACK) {
      const all = lucideNames(getIconIds());
      return {
        draw: drawLucide,
        // Nome, tags e categorias, como no lucide.dev: "money" acha "banknote".
        search: (query) =>
          measure("picker.lucideSearch", () => searchLucide(all, query)),
        selected: parseLucide(current)?.name,
        tintable: true,
        value: lucideValue,
      };
    }
    const names = packNames(pack.id);
    const parsed = parsePackIcon(current);
    return {
      draw: (el, name) => {
        drawPackIcon(el, packIconValue(pack.id, name, null));
      },
      search: (query) =>
        measure("picker.packSearch", () => searchPack(names, query)),
      selected: parsed?.pack === pack.id ? parsed.name : undefined,
      tintable: pack.tintable,
      value: (name, color) =>
        packIconValue(
          pack.id,
          name,
          pack.tintable && color !== DEFAULT_ICON_COLOR ? color : null
        ),
    };
  }

  /**
   * Aba Ícones: o Lucide e, com pacotes instalados, uma sub-aba para cada um
   * embaixo da busca. A busca continua ao trocar de pacote.
   */
  private renderIcons(): void {
    const { packs } = this.options;
    let source: IconSource | null = null;
    let matches: readonly string[] = [];
    let shown = 0;

    const { input, row } = this.searchRow(
      t("iconPicker.filterIcons"),
      asyncListener(async () => {
        const name = randomItem(matches);
        if (name && source) {
          await this.pick(source.value(name, this.colorState.color));
        }
      })
    );
    const title = this.body.createDiv({ cls: "mdp-picker-section-title" });
    const grid = this.body.createDiv({ cls: "mdp-icon-grid" });
    const colorButton = renderColorButton({
      grid,
      onAskColorChange: this.options.onAskColorChange,
      onColorChange: this.options.onColorChange,
      row,
      state: this.colorState,
    });
    const status = this.body.createDiv({ cls: "mdp-picker-hint is-empty" });
    const sentinel = this.body.createDiv({ cls: "mdp-icon-sentinel" });

    const more = (): void => {
      if (!source) {
        return;
      }
      const shownSource = source;
      const next = matches.slice(shown, shown + BATCH);
      for (const name of next) {
        const button = optionButton(
          grid,
          name,
          name === shownSource.selected,
          async () => {
            await this.pickIcon(button, name, shownSource);
          }
        );
        shownSource.draw(button, name);
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
      matches = source ? source.search(input.value) : [];
      this.closeVariants?.();
      grid.empty();
      shown = 0;
      status.setText(t("iconPicker.noIcons"));
      status.toggle(source !== null && matches.length === 0);
      more();
    };

    // Sub-abas dos pacotes; com um só, não há o que escolher.
    const packTabs = new Map<string, HTMLElement>();
    const show = async (pack: PickerPack): Promise<void> => {
      this.packId = pack.id;
      for (const [id, tab] of packTabs) {
        tab.toggleClass("is-active", id === pack.id);
      }
      title.setText(pack.name);
      grid.toggleClass("is-lucide", pack.tintable);
      colorButton.toggle(pack.tintable);
      source = null;
      filter();
      if (pack.id !== LUCIDE_PACK) {
        status.setText(t("settings.storage.loading"));
        status.show();
        await loadPack(pack.id);
      }
      // Trocou de pacote enquanto este carregava: o outro já está à vista.
      if (this.packId === pack.id) {
        source = this.iconSource(pack);
        filter();
      }
    };
    if (packs.length > 1) {
      const bar = row.createDiv({ cls: "mdp-pack-tabs" });
      for (const pack of packs) {
        const tab = bar.createEl("button", {
          cls: "mdp-pack-tab",
          text: pack.name,
        });
        tab.addEventListener(
          "click",
          asyncListener(async () => {
            if (this.packId !== pack.id) {
              this.options.onPackChange(pack.id);
              await show(pack);
            }
            input.focus();
          })
        );
        packTabs.set(pack.id, tab);
      }
    }

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
    const first =
      packs.find((pack) => pack.id === this.packId) ??
      packs.find((pack) => pack.id === LUCIDE_PACK);
    if (first) {
      void show(first);
    }
    input.focus();
  }

  /** Com "Perguntar sempre", mostra o ícone nas cores; senão, usa a cor atual. */
  private async pickIcon(
    button: HTMLElement,
    name: string,
    source: IconSource
  ): Promise<void> {
    if (!(source.tintable && this.colorState.askColor)) {
      await this.pick(source.value(name, this.colorState.color));
      return;
    }
    this.closeVariants?.();
    this.closeVariants = showColorVariants(
      this.body,
      button,
      (el) => {
        source.draw(el, name);
      },
      this.colorState,
      async (color) => {
        await this.pick(source.value(name, color));
      }
    );
  }

  private async pick(value: string): Promise<void> {
    this.close();
    await this.options.onPick(value);
  }
}
