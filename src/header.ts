import { setIcon } from "obsidian";
import type { App } from "obsidian";

import { asyncListener } from "./async-listener";
import { t } from "./i18n";
import type CoverlyPlugin from "./main";
import { ZOOM_STEP, clampZoom, resolveCoverSource } from "./note-data";
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
  onClick?: () => void
): HTMLElement => {
  const button = parent.createEl("button", {
    attr: { "aria-label": label },
    cls: "mdp-toolbar-btn is-icon",
  });
  setIcon(button, iconId);
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
};

/**
 * Quanto o fundo excede a moldura em cada eixo, em px. É isso que converte a
 * distância arrastada em porcentagem.
 */
interface Overflow {
  x: number;
  y: number;
}

/** Dimensiona a camada da capa para um zoom e devolve a sobra em cada eixo. */
type Layout = (zoom: number) => Promise<Overflow>;

/** O degradê é desenhado maior que a capa; o zoom aumenta os dois lados. */
const GRADIENT_SCALE = 2.5;

const gradientSize = (zoom: number): string =>
  `${zoom}% ${GRADIENT_SCALE * zoom}%`;

const gradientLayout =
  (cover: HTMLElement, surface: HTMLElement): Layout =>
  (zoom) => {
    surface.style.backgroundSize = gradientSize(zoom);
    return Promise.resolve({
      x: cover.clientWidth * (zoom / 100 - 1),
      y: cover.clientHeight * ((GRADIENT_SCALE * zoom) / 100 - 1),
    });
  };

interface NaturalSize {
  height: number;
  width: number;
}

/** Tamanho real das fotos, medido uma vez por endereço. */
const naturalSizes = new Map<string, Promise<NaturalSize | null>>();

const probeSize = async (url: string): Promise<NaturalSize | null> => {
  const probe = new Image();
  probe.src = url;
  try {
    await probe.decode();
  } catch {
    // Imagem que não carrega não tem o que arrastar.
    return null;
  }
  return { height: probe.naturalHeight, width: probe.naturalWidth };
};

const naturalSize = async (url: string): Promise<NaturalSize | null> => {
  let size = naturalSizes.get(url);
  if (!size) {
    size = probeSize(url);
    naturalSizes.set(url, size);
  }
  const result = await size;
  // Falha não fica guardada: a imagem pode aparecer no vault depois.
  if (!result) {
    naturalSizes.delete(url);
  }
  return result;
};

/**
 * Foto no encaixe "cobrir" da moldura, ampliada pelo zoom. O tamanho é em
 * porcentagem de um dos lados, então continua certo ao redimensionar a janela.
 */
const photoLayout =
  (cover: HTMLElement, surface: HTMLElement, url: string): Layout =>
  async (zoom) => {
    const natural = await naturalSize(url);
    if (!natural) {
      surface.setCssStyles({ backgroundSize: "cover" });
      return { x: 0, y: 0 };
    }
    const frameWidth = cover.clientWidth;
    const frameHeight = cover.clientHeight;
    // Se a foto é mais larga que a moldura, a altura cobre e a largura segue a proporção; senão, o contrário.
    const wider = natural.width / natural.height >= frameWidth / frameHeight;
    surface.style.backgroundSize = wider ? `auto ${zoom}%` : `${zoom}% auto`;
    const drawnHeight = wider
      ? (frameHeight * zoom) / 100
      : (frameWidth * zoom * natural.height) / (100 * natural.width);
    const drawnWidth = (drawnHeight * natural.width) / natural.height;
    return {
      x: Math.max(0, drawnWidth - frameWidth),
      y: Math.max(0, drawnHeight - frameHeight),
    };
  };

/** Ponto da moldura, em px, que fica parado enquanto o zoom muda. */
interface Anchor {
  x: number;
  y: number;
}

/** Duração da animação do zoom pelos botões; é a mesma do CSS (.is-zoom-smooth). */
const ZOOM_SMOOTH_MS = 250;
/** Tempo que o zoom da roda fica sem transição, para tamanho e posição andarem juntos. */
const ZOOM_LIVE_MS = 150;
/** Quanto cada unidade de rolagem amplia: uma volta da roda (100) dá uns 16%. */
const WHEEL_ZOOM_RATE = 0.0015;

interface ZoomOptions {
  /** Ponto da moldura que fica parado durante o zoom. */
  anchor?: Anchor;
  /** Anima tamanho e posição (botões); sem isso o zoom é aplicado na hora (roda). */
  smooth?: boolean;
}

/**
 * Nova posição (%) de um eixo que mantém sob o `anchor` o mesmo ponto da
 * imagem depois do zoom. `before` e `after` são a sobra do eixo em cada zoom.
 */
const anchoredPosition = (
  anchor: number,
  position: number,
  frame: number,
  before: number,
  after: number
): number => {
  if (after <= 0) {
    return position;
  }
  // Fração da imagem que estava sob o âncora antes do zoom.
  const point = (anchor + (position / 100) * before) / (frame + before);
  return clamp(((point * (frame + after) - anchor) * 100) / after, 0, 100);
};

/**
 * Reposicionamento por arrasto e zoom. A distância arrastada é convertida em
 * porcentagem usando a sobra que `layout` devolve em cada eixo.
 */
/** Botões que entram e saem do modo de reposicionar. */
interface RepositionControls {
  cancel: HTMLElement;
  save: HTMLElement;
  start: HTMLElement;
  zoomIn: HTMLElement;
  zoomOut: HTMLElement;
}

/** Posição (em % nos dois eixos) e zoom: o ponto de partida e o de volta ao cancelar. */
interface Frame {
  x: number;
  y: number;
  zoom: number;
}

const attachReposition = (
  plugin: CoverlyPlugin,
  cover: HTMLElement,
  surface: HTMLElement,
  controls: RepositionControls,
  layout: Layout,
  initial: Frame,
  sourcePath: string
): void => {
  let active = false;
  let dragging = false;
  let overflow: Overflow = { x: 0, y: 0 };
  let startX = 0;
  let startY = 0;
  let startFrame = initial;
  let current = initial;
  let { zoom } = initial;

  const setFrame = (x: number, y: number): void => {
    current = { ...current, x, y };
    surface.style.backgroundPosition = `${x}% ${y}%`;
  };

  // Zoom muda a sobra da camada, então o arrasto passa a converter com a nova.
  // Com `anchor`, a posição acompanha: o ponto sob ele não sai do lugar.
  let zoomTimer = 0;
  const setZoom = async (
    next: number,
    { anchor, smooth = false }: ZoomOptions = {}
  ): Promise<void> => {
    // Só uma das duas classes vale por vez; a transição some depois do zoom.
    cover.toggleClass("is-zoom-smooth", smooth);
    cover.toggleClass("is-zoom-live", !smooth);
    window.clearTimeout(zoomTimer);
    zoomTimer = window.setTimeout(
      () => {
        cover.removeClass("is-zoom-smooth");
        cover.removeClass("is-zoom-live");
      },
      smooth ? ZOOM_SMOOTH_MS : ZOOM_LIVE_MS
    );
    const before = overflow;
    zoom = clampZoom(next);
    overflow = await layout(zoom);
    if (anchor) {
      setFrame(
        anchoredPosition(
          anchor.x,
          current.x,
          cover.clientWidth,
          before.x,
          overflow.x
        ),
        anchoredPosition(
          anchor.y,
          current.y,
          cover.clientHeight,
          before.y,
          overflow.y
        )
      );
    }
  };

  // Os botões ampliam a partir do centro da capa.
  const center = (): Anchor => ({
    x: cover.clientWidth / 2,
    y: cover.clientHeight / 2,
  });

  const exit = (): void => {
    active = false;
    dragging = false;
    cover.removeClass("is-repositioning");
    cover.removeClass("is-dragging");
    // oxlint-disable-next-line no-use-before-define
    document.removeEventListener("keydown", onKeydown, true);
  };

  // Cancelar (ou Esc) sai sem salvar e devolve a capa à posição e ao zoom anteriores.
  const cancel = (): void => {
    setFrame(initial.x, initial.y);
    void setZoom(initial.zoom, { smooth: true });
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
      overflow = await layout(zoom);
    })
  );

  controls.cancel.addEventListener("click", cancel);

  controls.zoomIn.addEventListener("click", () => {
    void setZoom(zoom + ZOOM_STEP, { anchor: center(), smooth: true });
  });
  controls.zoomOut.addEventListener("click", () => {
    void setZoom(zoom - ZOOM_STEP, { anchor: center(), smooth: true });
  });

  controls.save.addEventListener(
    "click",
    asyncListener(async () => {
      exit();
      const x = Math.round(current.x);
      const y = Math.round(current.y);
      // A roda dá passos fracionados; na nota o zoom fica em número inteiro.
      const savedZoom = Math.round(zoom);
      const changed =
        x !== Math.round(initial.x) ||
        y !== Math.round(initial.y) ||
        savedZoom !== initial.zoom;
      if (changed) {
        await plugin.setFrame(sourcePath, { x, y, zoom: savedZoom });
      }
    })
  );

  cover.addEventListener("pointerdown", (event) => {
    if (!active || (overflow.x <= 0 && overflow.y <= 0)) {
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
    cover.addClass("is-dragging");
    startX = event.clientX;
    startY = event.clientY;
    startFrame = current;
    cover.setPointerCapture(event.pointerId);
  });

  cover.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    // Eixo sem sobra (ex.: degradê na largura) não se move.
    const x =
      overflow.x > 0
        ? clamp(startFrame.x - (dx * 100) / overflow.x, 0, 100)
        : startFrame.x;
    const y =
      overflow.y > 0
        ? clamp(startFrame.y - (dy * 100) / overflow.y, 0, 100)
        : startFrame.y;
    setFrame(x, y);
  });

  const stop = (): void => {
    dragging = false;
    cover.removeClass("is-dragging");
  };
  cover.addEventListener("pointerup", stop);
  cover.addEventListener("pointercancel", stop);

  // A roda aproxima ou afasta só no modo de reposicionar; fora dele a página rola.
  cover.addEventListener(
    "wheel",
    (event) => {
      if (!active) {
        return;
      }
      event.preventDefault();
      // Zoom proporcional: o touchpad, que manda muitos eventos pequenos,
      // fica tão suave quanto a roda, sem disparar até o limite.
      const frame = cover.getBoundingClientRect();
      void setZoom(zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE), {
        anchor: {
          x: event.clientX - frame.left,
          y: event.clientY - frame.top,
        },
      });
    },
    { passive: false }
  );
};

/**
 * Pinta a capa da nota em `surface`: foto ou degradê, na posição gravada.
 * A foto recebe o tamanho em `buildCover`, que conhece o zoom e a moldura.
 */
export const paintCover = (
  app: App,
  surface: HTMLElement,
  data: CoverData
): CoverSource | null => {
  const source = resolveCoverSource(app, data.cover);
  surface.style.backgroundPosition = `${data.positionX}% ${data.position}%`;
  if (source?.kind === "image") {
    // Aspas no caminho quebrariam a declaração CSS, então são escapadas.
    surface.setCssStyles({
      backgroundImage: `url("${source.url.replaceAll('"', "%22")}")`,
      backgroundSize: "cover",
    });
  } else {
    surface.style.backgroundImage = source?.css ?? "";
    surface.style.backgroundSize = gradientSize(data.zoom);
  }
  return source;
};

const buildCover = (
  plugin: CoverlyPlugin,
  data: CoverData,
  sourcePath: string
): HTMLElement => {
  const cover = createDiv({ cls: "mdp-cover" });

  // Foto e degradê ficam na mesma camada, então os dois podem ser reposicionados.
  const surface = cover.createDiv({ cls: "mdp-cover-image" });
  const source = paintCover(plugin.app, surface, data);
  const layout: Layout =
    source?.kind === "image"
      ? photoLayout(cover, surface, source.url)
      : gradientLayout(cover, surface);
  void layout(data.zoom);

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
  // Os botões de zoom são ligados em attachReposition, que guarda o zoom atual.
  const zoomOut = toolbarIconButton(editbar, "zoom-out", t("header.zoomOut"));
  const zoomIn = toolbarIconButton(editbar, "zoom-in", t("header.zoomIn"));
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
    { cancel, save, start, zoomIn, zoomOut },
    layout,
    { x: data.positionX, y: data.position, zoom: data.zoom },
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
  if (plugin.settings.nameColors) {
    addButton(addRow, "palette", t("header.nameColor"), (button) => {
      plugin.openColorPopup(sourcePath, button);
    });
  }
  addButton(addRow, "type", t("header.font"), (button) => {
    plugin.openFontPopup(sourcePath, button);
  });
  if (plugin.settings.noteAccents) {
    addButton(addRow, "droplet", t("header.accentColor"), (button) => {
      plugin.openAccentPopup(sourcePath, button);
    });
  }
  if (plugin.settings.noteBackgrounds) {
    const backgroundLabel = data.background
      ? t("header.changeBackground")
      : t("header.addBackground");
    addButton(addRow, "paintbrush", backgroundLabel, (button) => {
      plugin.openBackgroundPicker(sourcePath, button);
    });
  }
  if (!data.cover) {
    addButton(addRow, "image", t("header.addCover"), (button) => {
      plugin.openCoverPicker(sourcePath, button);
    });
  }

  return header;
};
