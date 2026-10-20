import { setIcon } from "obsidian";
import type { App } from "obsidian";

import { asyncListener } from "./async-listener";
import {
  coverPlaceholder,
  placeholderCount,
  preparePlaceholder,
} from "./cover-placeholder";
import { coverDisplayUrl, coverThumbUrl } from "./cover-thumbs";
import { t } from "./i18n";
import type CoverlyPlugin from "./main";
import { ZOOM_STEP, clampZoom, resolveCoverSource } from "./note-data";
import type { CoverData, CoverSource } from "./note-data";
import { drawPageIcon } from "./page-icon";
import { count } from "./perf";

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
const naturalSizes = new Map<string, NaturalSize>();

/**
 * Fotos "quentes": as últimas capas decodificadas, guardadas vivas. Enquanto
 * um `Image` aponta para a foto, o navegador não a descarta da memória, e a
 * capa aparece sem transição. Antes era só uma lista de endereços já vistos:
 * depois de um tempo o navegador descartava a foto, a lista continuava
 * dizendo "pronta", e a moldura ficava vazia até a foto voltar do disco.
 */
const HOT_LIMIT = 6;
const hot = new Map<string, HTMLImageElement>();
const decoding = new Map<string, Promise<HTMLImageElement | null>>();

const keepHot = (url: string, image: HTMLImageElement): void => {
  hot.delete(url);
  hot.set(url, image);
  const oldest = hot.keys().next().value;
  if (hot.size > HOT_LIMIT && oldest !== undefined) {
    hot.delete(oldest);
  }
};

/** A foto está na memória agora (e passa a ser a mais recente). */
const isHot = (url: string): boolean => {
  const image = hot.get(url);
  if (image) {
    keepHot(url, image);
  }
  return image !== undefined;
};

const decodeImage = async (url: string): Promise<HTMLImageElement | null> => {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    // Imagem que não carrega não tem o que arrastar.
    return null;
  } finally {
    decoding.delete(url);
  }
  keepHot(url, image);
  naturalSizes.set(url, {
    height: image.naturalHeight,
    width: image.naturalWidth,
  });
  return image;
};

/** Carrega e decodifica a foto (uma vez, mesmo com vários pedidos juntos). */
const loadDecoded = (url: string): Promise<HTMLImageElement | null> => {
  const image = hot.get(url);
  if (image) {
    return Promise.resolve(image);
  }
  let pending = decoding.get(url);
  if (!pending) {
    pending = decodeImage(url);
    decoding.set(url, pending);
  }
  return pending;
};

const naturalSize = async (url: string): Promise<NaturalSize | null> => {
  const known = naturalSizes.get(url);
  if (known) {
    return known;
  }
  const image = await loadDecoded(url);
  return image
    ? { height: image.naturalHeight, width: image.naturalWidth }
    : null;
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

/** Tamanhos dos caches de imagem, para o relatório de desempenho. */
export const headerCacheStats = (): Record<string, number> => ({
  hot: hot.size,
  naturalSizes: naturalSizes.size,
  placeholders: placeholderCount(),
});

/**
 * Adianta a prévia borrada da capa antes de a nota abrir (ao passar o mouse
 * pelo link ou pelo item do explorador). Só ela: decodificar a versão de
 * 2560px no hover custaria caro para uma nota que talvez nem seja aberta.
 */
export const preloadCover = (app: App, cover: string | undefined): void => {
  const source = resolveCoverSource(app, cover);
  if (source?.kind !== "image" || !cover) {
    return;
  }
  // Pede a miniatura se ainda não existe; a prévia sai dela.
  coverThumbUrl(cover);
  void preparePlaceholder(app, cover);
};

/** `url(...)` para o CSS. Aspas no caminho quebrariam a declaração, então são escapadas. */
const cssUrl = (url: string): string => `url("${url.replaceAll('"', "%22")}")`;

interface CoverVariants {
  display: string | null;
  thumb: string | null;
}

/** Versões em disco da capa; a de exibição fica de fora quando só a miniatura serve. */
const coverVariants = (
  cover: string | undefined,
  resolved: CoverSource | null,
  preferThumb: boolean
): CoverVariants => {
  if (resolved?.kind !== "image" || !cover) {
    return { display: null, thumb: null };
  }
  return {
    display: preferThumb ? null : coverDisplayUrl(cover),
    thumb: coverThumbUrl(cover),
  };
};

/**
 * Põe a foto na capa sem nunca deixar a moldura vazia:
 *
 * - por baixo da foto fica a prévia borrada (`data:` URL, desenhada na hora;
 *   ver cover-placeholder.ts). Se o navegador ainda não tem a foto pronta,
 *   aparece a prévia, e não um buraco;
 * - foto quente (na memória): aparece direto, sem transição;
 * - foto fria: a prévia fica também por cima, borrada, e se dissolve quando a
 *   foto termina de decodificar.
 */
const paintPhoto = (
  app: App,
  surface: HTMLElement,
  cover: string,
  url: string,
  thumb: string | null,
  onReady?: () => void
): void => {
  const placeholder = coverPlaceholder(cover);
  // Sem prévia ainda (primeira vez desta capa), a miniatura do disco serve.
  const under = placeholder ?? (thumb && thumb !== url ? thumb : null);
  // Para a próxima vez: a prévia fica pronta em segundo plano.
  void preparePlaceholder(app, cover);
  surface.setCssStyles({
    backgroundImage: under ? `${cssUrl(url)}, ${cssUrl(under)}` : cssUrl(url),
    backgroundSize: "cover",
  });
  // Cartão pequeno (prévia de link) mostrando a própria miniatura: ela é leve
  // e não ocupa o lugar das fotos quentes.
  if (url === thumb) {
    onReady?.();
    return;
  }
  if (isHot(url)) {
    count("cover.hot");
    onReady?.();
    return;
  }
  count(placeholder ? "cover.cold" : "cover.coldNoPlaceholder");
  if (under) {
    surface.style.setProperty("--mdp-cover-thumb", cssUrl(under));
    surface.addClass("mdp-has-thumb");
  }
  void (async () => {
    // A prévia em memória já está na tela; a miniatura do disco, não.
    if (placeholder) {
      onReady?.();
    } else if (under) {
      await Promise.race([naturalSize(under), loadDecoded(url)]);
      onReady?.();
    }
    await loadDecoded(url);
    surface.addClass("is-loaded");
    if (!under) {
      onReady?.();
    }
  })();
};

/**
 * Pinta a capa da nota em `surface`: foto ou degradê, na posição gravada.
 * A foto recebe o tamanho em `buildCover`, que conhece o zoom e a moldura.
 * `onReady` roda quando já há algo da foto para mostrar (a miniatura ou a
 * imagem inteira, a que chegar primeiro).
 */
export const paintCover = (
  app: App,
  surface: HTMLElement,
  data: CoverData,
  onReady?: () => void,
  // Cartões pequenos (prévia de link) ficam bem servidos pela miniatura.
  preferThumb = false
): CoverSource | null => {
  count("header.paintCover");
  const resolved = resolveCoverSource(app, data.cover);
  // A versão de exibição (até 2560px, já no disco) abre bem mais rápido que a
  // foto original, que pode ter vários MB para decodificar.
  const { display, thumb } = coverVariants(data.cover, resolved, preferThumb);
  let source: CoverSource | null = resolved;
  // Se a foto original já está na tela e a versão de exibição acabou de ficar
  // pronta, continua na original: trocar de endereço refaria a transição
  // borrada (visível ao salvar a posição). A troca vem no próximo
  // carregamento da nota.
  const keepOriginal =
    display !== null && resolved?.kind === "image" && hot.has(resolved.url);
  if (display && keepOriginal) {
    void loadDecoded(display);
  } else if (display) {
    source = { kind: "image", url: display };
  } else if (preferThumb && thumb) {
    source = { kind: "image", url: thumb };
  }
  surface.style.backgroundPosition = `${data.positionX}% ${data.position}%`;
  surface.removeClass("mdp-has-thumb", "is-loaded");
  if (source?.kind === "image") {
    paintPhoto(
      app,
      surface,
      data.cover ?? source.url,
      source.url,
      thumb,
      onReady
    );
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
  // A animação de entrada espera ter o que mostrar; senão ela rodaria sobre a
  // moldura vazia e a foto "apareceria" depois dela, como se recomeçasse.
  cover.addClass("is-pending");
  const source = paintCover(plugin.app, surface, data, () => {
    cover.removeClass("is-pending");
  });
  if (source?.kind !== "image") {
    cover.removeClass("is-pending");
  }
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
 *
 * `cover` é uma capa já montada para os mesmos dados: reaproveitá-la evita
 * recriar a imagem (e piscar) quando só o ícone muda.
 */
export const buildHeader = (
  plugin: CoverlyPlugin,
  data: CoverData,
  sourcePath: string,
  entering: boolean,
  cover?: HTMLElement | null
): HTMLElement => {
  const header = createDiv({ cls: "mdp-header" });
  header.toggleClass("has-cover", Boolean(data.cover));
  // Na linha do título o ícone é pintado no título (view-header.ts), não aqui.
  const inline = plugin.settings.iconPosition === "inline";
  header.toggleClass("has-icon", Boolean(data.icon) && !inline);
  header.toggleClass("is-entering", entering);

  if (data.cover) {
    header.append(cover ?? buildCover(plugin, data, sourcePath));
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
      void plugin.openIconPicker(sourcePath, icon);
    });
  }

  // Ações de adicionar aparecem só ao passar o mouse, para não poluir a nota.
  const addRow = header.createDiv({ cls: "mdp-add-row" });
  // Na linha do título o ícone não é clicável, então o botão fica aqui.
  if (!data.icon || inline) {
    const label = data.icon ? t("header.changeIcon") : t("header.addIcon");
    addButton(addRow, "smile", label, (button) => {
      void plugin.openIconPicker(sourcePath, button);
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
