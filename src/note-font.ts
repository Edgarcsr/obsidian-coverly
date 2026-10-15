import { asyncListener } from "./async-listener";
import { openFloatingPopup, renderPopupHeader } from "./floating-popup";
import type { PopupPosition } from "./floating-popup";
import { t } from "./i18n";
import type { MessageKey } from "./i18n";
import { installedFonts } from "./system-fonts";

/** Fontes prontas do quadro. A padrão é a do tema (sem propriedade). */
export const NOTE_FONTS = ["default", "serif", "mono"] as const;

export type NoteFont = (typeof NOTE_FONTS)[number];

/** Fontes prontas gravadas na nota: "default" é a ausência da propriedade. */
export type StoredFont = Exclude<NoteFont, "default">;

const LABELS: Record<NoteFont, MessageKey> = {
  default: "font.default",
  mono: "font.mono",
  serif: "font.serif",
};

const CLASS_PREFIX = "mdp-font-";
const CUSTOM_CLASS = `${CLASS_PREFIX}custom`;
const CUSTOM_VARIABLE = "--mdp-note-font";

/** Tamanho máximo do nome de uma fonte personalizada. */
const MAX_FAMILY_LENGTH = 60;

/** Tudo que não é letra, número, espaço, ponto, hífen ou sublinhado. */
const UNSAFE_FAMILY_CHARS = /[^\p{L}\p{N} _.-]/gu;

export const isStoredFont = (value: unknown): value is StoredFont =>
  value === "serif" || value === "mono";

/**
 * Nome de fonte personalizada já limpo, ou `undefined` se não sobrar nada.
 * O valor vem de uma propriedade que o usuário pode editar à mão e vai parar
 * numa declaração CSS, então só passam caracteres inofensivos.
 */
export const cleanFamily = (value: string): string | undefined => {
  const family = value
    .replaceAll(UNSAFE_FAMILY_CHARS, "")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_FAMILY_LENGTH);
  return family === "" ? undefined : family;
};

/**
 * Troca a fonte de `el` (a área de conteúdo da view); sem `font`, volta à do
 * tema. Qualquer valor que não seja uma fonte pronta é um nome de fonte
 * personalizada, só aceito com `allowCustom` ligado.
 */
export const applyFont = (
  el: HTMLElement,
  font?: string,
  allowCustom = false
): void => {
  const preset = isStoredFont(font) ? font : undefined;
  const family = !preset && allowCustom && font ? cleanFamily(font) : undefined;

  for (const name of NOTE_FONTS) {
    el.toggleClass(`${CLASS_PREFIX}${name}`, name === preset);
  }
  el.toggleClass(CUSTOM_CLASS, family !== undefined);
  if (family) {
    // Se a fonte não estiver instalada, o texto cai na fonte do tema.
    el.style.setProperty(CUSTOM_VARIABLE, `"${family}", var(--font-text)`);
  } else {
    el.style.removeProperty(CUSTOM_VARIABLE);
  }
};

export interface FontPopupOptions {
  /** Valor gravado na nota: uma fonte pronta ou o nome de uma personalizada. */
  current: string | undefined;
  position: PopupPosition;
  /** Mostra o campo para digitar o nome de qualquer fonte instalada. */
  allowCustom: boolean;
  onPick: (font: NoteFont) => Promise<void>;
  onPickCustom: (family: string) => Promise<void>;
}

/** Quantas fontes entram na lista por vez; o resto vem ao rolar até perto do fim. */
const PAGE_SIZE = 60;

/** Distância do fim da lista, em px, a partir da qual a próxima leva é desenhada. */
const NEAR_END = 48;

/**
 * Busca e lista das fontes instaladas no sistema, cada uma desenhada na
 * própria fonte. Se o Obsidian não deixar listá-las, sobra o campo de texto
 * para digitar o nome.
 */
const renderCustomFonts = (
  popup: HTMLElement,
  options: FontPopupOptions,
  close: () => void
): void => {
  const section = popup.createDiv({ cls: "mdp-font-custom" });
  const row = section.createDiv({ cls: "mdp-font-custom-row" });
  const input = row.createEl("input", {
    attr: { spellcheck: "false" },
    cls: "mdp-font-custom-input",
    placeholder: t("font.custom.placeholder"),
    type: "text",
  });
  const apply = row.createEl("button", {
    cls: "mod-cta",
    text: t("font.custom.apply"),
  });
  const list = section.createDiv({ cls: "mdp-font-list" });
  list.createDiv({ cls: "mdp-font-list-hint", text: t("font.custom.loading") });
  section.createDiv({
    cls: "mdp-font-custom-hint",
    text: t("font.custom.hint"),
  });

  const { current } = options;
  const selectedFamily = current && !isStoredFont(current) ? current : "";
  input.value = selectedFamily;

  const choose = async (family: string): Promise<void> => {
    close();
    await options.onPickCustom(family);
  };

  const send = async (): Promise<void> => {
    const family = cleanFamily(input.value);
    if (family) {
      await choose(family);
    }
  };

  let matches: string[] = [];
  let shown = 0;

  const addItem = (family: string): void => {
    const item = list.createEl("button", {
      cls:
        family === selectedFamily
          ? "mdp-font-list-item is-selected"
          : "mdp-font-list-item",
      text: family,
    });
    // O nome já vem do sistema, mas passa pela mesma limpeza das digitadas.
    const safe = cleanFamily(family);
    if (safe) {
      item.style.fontFamily = `"${safe}", var(--font-interface)`;
    }
    item.addEventListener(
      "click",
      asyncListener(async () => {
        await choose(family);
      })
    );
  };

  const showMore = (): void => {
    for (const family of matches.slice(shown, shown + PAGE_SIZE)) {
      addItem(family);
    }
    shown = Math.min(matches.length, shown + PAGE_SIZE);
  };

  const showList = (families: readonly string[] | null): void => {
    list.empty();
    if (!families) {
      // Sem a lista, o campo de texto basta.
      list.remove();
      return;
    }
    const query = input.value.trim().toLowerCase();
    matches = families.filter((family) => family.toLowerCase().includes(query));
    shown = 0;
    if (matches.length === 0) {
      list.createDiv({
        cls: "mdp-font-list-hint",
        text: t("font.custom.none"),
      });
      return;
    }
    showMore();
  };

  // Centenas de fontes desenhadas de uma vez travariam o quadro: entram por levas.
  list.addEventListener("scroll", () => {
    const nearEnd =
      list.scrollTop + list.clientHeight >= list.scrollHeight - NEAR_END;
    if (nearEnd && shown < matches.length) {
      showMore();
    }
  });

  const loadList = async (): Promise<void> => {
    const families = await installedFonts();
    // O quadro pode ter sido fechado enquanto a lista carregava.
    if (!section.isConnected) {
      return;
    }
    input.addEventListener("input", () => {
      showList(families);
    });
    showList(families);
  };
  void loadList();

  apply.addEventListener("click", asyncListener(send));
  input.addEventListener(
    "keydown",
    asyncListener(async (event) => {
      if (event.key === "Enter") {
        await send();
      }
    })
  );
  input.focus();
};

/** Quadro "Estilo da fonte", como no Notion: cada opção mostra um "Ag" na própria fonte. */
export const showFontPopup = (options: FontPopupOptions): void => {
  const isCustom = Boolean(options.current) && !isStoredFont(options.current);
  // Uma fonte personalizada gravada não marca nenhuma das prontas.
  const selected = isCustom ? undefined : (options.current ?? "default");

  openFloatingPopup("mdp-font-popup", options.position, (popup, close) => {
    renderPopupHeader(
      popup,
      t("font.title"),
      selected === "default"
        ? null
        : async () => {
            await options.onPick("default");
          },
      close
    );
    const row = popup.createDiv({ cls: "mdp-font-options" });

    for (const font of NOTE_FONTS) {
      const option = row.createEl("button", {
        cls:
          font === selected ? "mdp-font-option is-selected" : "mdp-font-option",
      });
      option.createSpan({ cls: `mdp-font-sample is-${font}`, text: "Ag" });
      option.createSpan({ cls: "mdp-font-label", text: t(LABELS[font]) });
      option.addEventListener(
        "click",
        asyncListener(async () => {
          close();
          await options.onPick(font);
        })
      );
    }

    if (options.allowCustom) {
      renderCustomFonts(popup, options, close);
    }
  });
};
