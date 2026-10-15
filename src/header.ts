import { setIcon } from "obsidian";
import type { App } from "obsidian";

import { asyncListener } from "./async-listener";
import { t } from "./i18n";
import type CoverlyPlugin from "./main";
import { resolveCoverSource } from "./note-data";
import type { CoverData, CoverSource } from "./note-data";
import { drawPageIcon } from "./page-icon";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Ação discreta acima do título ("Adicionar ícone"). Os ícones são os Lucide que já vêm no Obsidian. */
const addButton = (
  parent: HTMLElement,
  iconId: string,
  label: string,
  // Recebe o próprio botão, para servir de âncora a popovers.
  onClick: (button: HTMLElement) => void
): void => {
  const button = parent.createEl("button", { cls: "mdp-add-btn" });
  setIcon(button.createSpan({ cls: "mdp-add-btn-icon" }), iconId);
  button.createSpan({ text: label });
  button.addEventListener("click", () => {
    onClick(button);
  });
};

/** Segmento de texto da pílula de ações da capa. */
const toolbarButton = (
  parent: HTMLElement,
  label: string,
  onClick?: () => void
): HTMLElement => {
  const button = parent.createEl("button", {
    cls: "mdp-toolbar-btn",
    text: label,
  });
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
};

/** Segmento só com ícone; o rótulo vai para leitores de tela e para a dica. */
const toolbarIconButton = (
  parent: HTMLElement,
  iconId: string,
  label: string,
  onClick: () => void
): void => {
  const button = parent.createEl("button", {
    attr: { "aria-label": label },
    cls: "mdp-toolbar-btn is-icon",
  });
  setIcon(button, iconId);
  button.addEventListener("click", onClick);
};

/**
 * Quantos px a capa pode deslizar na vertical: o quanto o fundo excede a
 * moldura. É o que converte a distância arrastada em porcentagem.
 */
type OverflowMeasure = () => Promise<number>;

/** O gradiente é desenhado mais alto que a capa; a sobra é o que dá para arrastar. */
const GRADIENT_SCALE = 2.5;

const gradientOverflow =
  (cover: HTMLElement): OverflowMeasure =>
  () =>
    Promise.resolve(cover.clientHeight * (GRADIENT_SCALE - 1));

/** Para fotos a sobra depende do tamanho real da imagem (background-size: cover). */
const imageOverflow =
  (cover: HTMLElement, url: string): OverflowMeasure =>
  async () => {
    const probe = new Image();
    probe.src = url;
    try {
      await probe.decode();
    } catch {
      // Imagem que não carrega não tem o que arrastar.
      return 0;
    }
    const frameHeight = cover.clientHeight;
    const scale = Math.max(
      cover.clientWidth / probe.naturalWidth,
      frameHeight / probe.naturalHeight
    );
    return probe.naturalHeight * scale - frameHeight;
  };

/**
 * Reposicionamento vertical por arrasto. A distância arrastada é convertida em
 * porcentagem usando o quanto o fundo excede a moldura (ver OverflowMeasure).
 */
/** Botões que entram e saem do modo de reposicionar. */
interface RepositionControls {
  start: HTMLElement;
  save: HTMLElement;
  cancel: HTMLElement;
}

const attachReposition = (
  plugin: CoverlyPlugin,
  cover: HTMLElement,
  surface: HTMLElement,
  controls: RepositionControls,
  measureOverflow: OverflowMeasure,
  initialPosition: number,
  sourcePath: string
): void => {
  let active = false;
  let dragging = false;
  let overflow = 0;
  let startY = 0;
  let startPosition = initialPosition;
  let current = initialPosition;

  const setPosition = (position: number): void => {
    current = position;
    surface.style.backgroundPosition = `50% ${position}%`;
  };

  const exit = (): void => {
    active = false;
    dragging = false;
    cover.removeClass("is-repositioning");
    // oxlint-disable-next-line no-use-before-define
    document.removeEventListener("keydown", onKeydown, true);
  };

  // Cancelar (ou Esc) sai sem salvar e devolve a capa à posição anterior.
  const cancel = (): void => {
    setPosition(initialPosition);
    exit();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    // O cabeçalho pode ter sido redesenhado no meio do caminho.
    if (!cover.isConnected) {
      document.removeEventListener("keydown", onKeydown, true);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  controls.start.addEventListener(
    "click",
    asyncListener(async () => {
      active = true;
      cover.addClass("is-repositioning");
      document.addEventListener("keydown", onKeydown, true);
      overflow = await measureOverflow();
    })
  );

  controls.cancel.addEventListener("click", cancel);

  controls.save.addEventListener(
    "click",
    asyncListener(async () => {
      exit();
      if (Math.round(current) !== Math.round(initialPosition)) {
        await plugin.setPosition(sourcePath, Math.round(current));
      }
    })
  );

  cover.addEventListener("pointerdown", (event) => {
    if (!active || overflow <= 0) {
      return;
    }
    // Clique na pílula não pode virar arrasto: a captura do ponteiro
    // roubaria o clique de "Salvar posição" e "Cancelar".
    if (
      event.target instanceof Element &&
      event.target.closest(".mdp-toolbar")
    ) {
      return;
    }
    dragging = true;
    startY = event.clientY;
    startPosition = current;
    cover.setPointerCapture(event.pointerId);
  });

  cover.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }
    const delta = event.clientY - startY;
    setPosition(clamp(startPosition - (delta * 100) / overflow, 0, 100));
  });

  const stop = (): void => {
    dragging = false;
  };
  cover.addEventListener("pointerup", stop);
  cover.addEventListener("pointercancel", stop);
};

/**
 * Pinta a capa da nota em `surface`: foto ou gradiente, na posição gravada.
 * O gradiente é desenhado mais alto que a moldura, como no reposicionamento.
 */
export const paintCover = (
  app: App,
  surface: HTMLElement,
  data: CoverData
): CoverSource | null => {
  const source = resolveCoverSource(app, data.cover);
  surface.style.backgroundPosition = `50% ${data.position}%`;
  if (source?.kind === "image") {
    // Aspas no caminho quebrariam a declaração CSS, então são escapadas.
    surface.style.backgroundImage = `url("${source.url.replaceAll('"', "%22")}")`;
  } else {
    surface.style.backgroundImage = source?.css ?? "";
    surface.style.backgroundSize = `100% ${GRADIENT_SCALE * 100}%`;
  }
  return source;
};

const buildCover = (
  plugin: CoverlyPlugin,
  data: CoverData,
  sourcePath: string
): HTMLElement => {
  const cover = createDiv({ cls: "mdp-cover" });

  // Foto e gradiente ficam na mesma camada, então os dois podem ser reposicionados.
  const surface = cover.createDiv({ cls: "mdp-cover-image" });
  const source = paintCover(plugin.app, surface, data);
  const measureOverflow: OverflowMeasure =
    source?.kind === "image"
      ? imageOverflow(cover, source.url)
      : gradientOverflow(cover);

  // Pílula normal, visível ao passar o mouse.
  const toolbar = cover.createDiv({ cls: "mdp-toolbar is-idle" });
  const change = toolbarButton(toolbar, t("header.change"));
  change.addEventListener("click", () => {
    plugin.openCoverPicker(sourcePath, change);
  });
  const start = toolbarButton(toolbar, t("header.reposition"));
  toolbarIconButton(
    toolbar,
    "trash-2",
    t("command.removeCover"),
    asyncListener(async () => {
      await plugin.setCover(sourcePath, null);
    })
  );

  // Pílula e dica do modo de reposicionar; o CSS troca uma pela outra.
  const editbar = cover.createDiv({ cls: "mdp-toolbar is-editing" });
  const save = toolbarButton(editbar, t("header.savePosition"));
  const cancel = toolbarButton(editbar, t("common.cancel"));
  cover.createDiv({
    cls: "mdp-reposition-hint",
    text: t("header.repositionHint"),
  });

  attachReposition(
    plugin,
    cover,
    surface,
    { cancel, save, start },
    measureOverflow,
    data.position,
    sourcePath
  );

  if (data.credit) {
    // O texto já vem completo ("Foto de X no Unsplash", "Hokusai, … · The Met").
    const credit = cover.createDiv({ cls: "mdp-credit" });
    const link = credit.createEl("a", {
      attr: { href: data.creditUrl ?? "#" },
      text: data.credit,
    });
    link.target = "_blank";
    link.rel = "noopener";
  }

  return cover;
};

/**
 * Monta capa + ícone. É o mesmo DOM para o modo de edição e o de leitura,
 * então o visual e as interações ficam idênticos nos dois.
 */
export const buildHeader = (
  plugin: CoverlyPlugin,
  data: CoverData,
  sourcePath: string,
  entering: boolean
): HTMLElement => {
  const header = createDiv({ cls: "mdp-header" });
  header.toggleClass("has-cover", Boolean(data.cover));
  // Na linha do título o ícone é pintado no título (view-header.ts), não aqui.
  const inline = plugin.settings.iconPosition === "inline";
  header.toggleClass("has-icon", Boolean(data.icon) && !inline);
  header.toggleClass("is-entering", entering);

  if (data.cover) {
    header.append(buildCover(plugin, data, sourcePath));
  }

  // A linha do ícone só existe com ícone: ela sobe sobre a capa, e vazia
  // arrastaria junto os botões de adicionar.
  if (data.icon && !inline) {
    const iconRow = header.createDiv({ cls: "mdp-icon-row" });
    const icon = iconRow.createEl("button", {
      attr: { "aria-label": t("header.changeIcon") },
      cls: "mdp-icon",
    });
    drawPageIcon(plugin.app, icon, data.icon, plugin.settings.twemoji);
    icon.addEventListener("click", () => {
      plugin.openIconPicker(sourcePath, icon);
    });
  }

  // Ações de adicionar aparecem só ao passar o mouse, para não poluir a nota.
  const addRow = header.createDiv({ cls: "mdp-add-row" });
  // Na linha do título o ícone não é clicável, então o botão fica aqui.
  if (!data.icon || inline) {
    const label = data.icon ? t("header.changeIcon") : t("header.addIcon");
    addButton(addRow, "smile", label, (button) => {
      plugin.openIconPicker(sourcePath, button);
    });
  }
  addButton(addRow, "type", t("header.font"), (button) => {
    plugin.openFontMenu(sourcePath, button);
  });
  const backgroundLabel = data.background
    ? t("header.changeBackground")
    : t("header.addBackground");
  addButton(addRow, "paintbrush", backgroundLabel, (button) => {
    plugin.openBackgroundPicker(sourcePath, button);
  });
  if (!data.cover) {
    addButton(addRow, "image", t("header.addCover"), (button) => {
      plugin.openCoverPicker(sourcePath, button);
    });
  }

  return header;
};
