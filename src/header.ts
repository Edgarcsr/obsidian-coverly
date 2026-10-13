import { setIcon } from "obsidian";

import type MdPlusPlugin from "./main";
import { resolveCoverSource } from "./note-data";
import type { CoverData } from "./note-data";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Ação discreta acima do título ("Adicionar ícone"), com ícone Lucide e rótulo. */
const addButton = (
  parent: HTMLElement,
  iconId: string,
  label: string,
  onClick: () => void
): void => {
  const button = parent.createEl("button", { cls: "mdp-add-btn" });
  setIcon(button.createSpan({ cls: "mdp-add-btn-icon" }), iconId);
  button.createSpan({ text: label });
  button.addEventListener("click", onClick);
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
 * Reposicionamento vertical por arrasto. A distância arrastada é convertida em
 * porcentagem usando o quanto a imagem excede a moldura (background-size: cover).
 */
const attachReposition = (
  plugin: MdPlusPlugin,
  cover: HTMLElement,
  surface: HTMLElement,
  button: HTMLElement,
  url: string,
  initialPosition: number,
  sourcePath: string
): void => {
  let active = false;
  let dragging = false;
  let overflow = 0;
  let startY = 0;
  let startPosition = initialPosition;
  let current = initialPosition;

  const measure = (): void => {
    const probe = new Image();
    probe.addEventListener("load", () => {
      const frameWidth = cover.clientWidth;
      const frameHeight = cover.clientHeight;
      const scale = Math.max(
        frameWidth / probe.naturalWidth,
        frameHeight / probe.naturalHeight
      );
      overflow = probe.naturalHeight * scale - frameHeight;
    });
    probe.src = url;
  };

  button.addEventListener("click", async () => {
    active = !active;
    cover.toggleClass("is-repositioning", active);
    button.setText(active ? "Concluir" : "Reposicionar");
    if (active) {
      measure();
      return;
    }
    if (Math.round(current) !== Math.round(initialPosition)) {
      await plugin.setPosition(sourcePath, Math.round(current));
    }
  });

  cover.addEventListener("pointerdown", (event) => {
    if (!active || overflow <= 0) {
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
    current = clamp(startPosition - (delta * 100) / overflow, 0, 100);
    surface.style.backgroundPosition = `50% ${current}%`;
  });

  const stop = (): void => {
    dragging = false;
  };
  cover.addEventListener("pointerup", stop);
  cover.addEventListener("pointercancel", stop);
};

const buildCover = (
  plugin: MdPlusPlugin,
  data: CoverData,
  sourcePath: string
): HTMLElement => {
  const cover = document.createElement("div");
  cover.className = "mdp-cover";

  const source = resolveCoverSource(plugin.app, data.cover);
  let surface: HTMLElement | null = null;

  if (source?.kind === "gradient") {
    cover.style.background = source.css;
  } else if (source?.kind === "image") {
    surface = cover.createDiv({ cls: "mdp-cover-image" });
    // Aspas no caminho quebrariam a declaração CSS, então são escapadas.
    surface.style.backgroundImage = `url("${source.url.replaceAll('"', "%22")}")`;
    surface.style.backgroundPosition = `50% ${data.position}%`;
  }

  const toolbar = cover.createDiv({ cls: "mdp-toolbar" });
  toolbarButton(toolbar, "Alterar", () => {
    plugin.openCoverPicker(sourcePath);
  });
  const reposition = toolbarButton(toolbar, "Reposicionar");
  toolbarIconButton(toolbar, "md-plus-trash", "Remover capa", async () => {
    await plugin.setCover(sourcePath, null);
  });

  if (surface && source?.kind === "image") {
    attachReposition(
      plugin,
      cover,
      surface,
      reposition,
      source.url,
      data.position,
      sourcePath
    );
  } else {
    reposition.hide();
  }

  if (data.credit) {
    const credit = cover.createDiv({ cls: "mdp-credit" });
    credit.createSpan({ text: "Foto de " });
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
  plugin: MdPlusPlugin,
  data: CoverData,
  sourcePath: string,
  entering: boolean
): HTMLElement => {
  const header = document.createElement("div");
  header.addClass("mdp-header");
  header.toggleClass("has-cover", Boolean(data.cover));
  header.toggleClass("is-entering", entering);

  if (data.cover) {
    header.append(buildCover(plugin, data, sourcePath));
  }

  const iconRow = header.createDiv({ cls: "mdp-icon-row" });
  if (data.icon) {
    const icon = iconRow.createEl("button", {
      attr: { "aria-label": "Trocar ícone" },
      cls: "mdp-icon",
      text: data.icon,
    });
    icon.addEventListener("click", () => {
      plugin.openIconPicker(sourcePath);
    });
  }

  // Ações de adicionar aparecem só ao passar o mouse, para não poluir a nota.
  const addRow = header.createDiv({ cls: "mdp-add-row" });
  if (!data.icon) {
    addButton(addRow, "md-plus-smile", "Adicionar ícone", () => {
      plugin.openIconPicker(sourcePath);
    });
  }
  if (!data.cover) {
    addButton(addRow, "md-plus-image", "Adicionar capa", () => {
      plugin.openCoverPicker(sourcePath);
    });
  }

  return header;
};
