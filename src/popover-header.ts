import type { Events } from "obsidian";

import { buildHeader } from "./header";
import { isHoverLinkInfo, resolveHoverFile } from "./link-preview";
import type CoverlyPlugin from "./main";
import { dataFromFrontmatter } from "./note-data";
import { MODES, anchorIn, bleed, findSlot, isPlaced } from "./view-header";
import type { Mode, Slot } from "./view-header";

/**
 * Quantas vezes o cabeçalho pode ser reposto num mesmo popover. Se o Obsidian
 * insiste em tirá-lo, repor sem fim brigaria com ele (e com a rolagem).
 */
const MAX_INSERTS = 4;

/** Quanto tempo depois do `hover-link` um popover ainda é dessa nota. */
const HOVER_WINDOW = 3000;

const POPOVER_SELECTOR = ".popover.hover-popover";

/**
 * No modo de leitura, o cabeçalho fica acima do `.markdown-preview-sizer`, e
 * não dentro dele: a prévia não tem o `.mod-header` das abas, e um elemento
 * estranho entre as seções confunde a rolagem virtual do Obsidian, que pula
 * de volta. No modo de edição, entra no `.cm-sizer`, como nas abas.
 */
const insertHeader = (header: HTMLElement, mode: Mode, slot: Slot): void => {
  if (mode === "preview") {
    slot.sizer.before(header);
  } else {
    slot.parent.insertBefore(header, anchorIn(slot.parent));
  }
};

const isInPlace = (header: HTMLElement, mode: Mode, slot: Slot): boolean =>
  mode === "preview"
    ? header.parentElement === slot.scroller &&
      header.nextElementSibling === slot.sizer
    : isPlaced(header, slot.parent);

interface PopoverState {
  path: string;
  observer: MutationObserver;
  inserts: number;
}

/**
 * Capa e ícone na prévia nativa do Obsidian (Ctrl + mouse sobre um link).
 *
 * O popover não é uma aba, então o HeaderManager não o enxerga, e o DOM dele
 * não diz de qual nota é. A nota vem do último `hover-link`, e cada popover
 * novo no `body` é observado até o conteúdo aparecer, quando ganha o mesmo
 * cabeçalho das notas abertas.
 */
export class PopoverHeaders {
  private readonly plugin: CoverlyPlugin;
  private readonly popovers = new Map<HTMLElement, PopoverState>();
  private lastHover: { path: string; time: number } | null = null;
  private bodyObserver: MutationObserver | null = null;
  private frame: number | null = null;

  constructor(plugin: CoverlyPlugin) {
    this.plugin = plugin;
  }

  register(): void {
    const { plugin } = this;
    // O `hover-link` não está nas tipagens do Workspace, só no `on` genérico de Events.
    const workspace: Events = plugin.app.workspace;
    plugin.registerEvent(
      workspace.on("hover-link", (info: unknown) => {
        if (!isHoverLinkInfo(info)) {
          return;
        }
        const file = resolveHoverFile(plugin.app, info);
        this.lastHover = file ? { path: file.path, time: Date.now() } : null;
      })
    );

    this.bodyObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.matches(POPOVER_SELECTOR)) {
            this.attach(node);
          }
        }
      }
      this.schedule();
    });
    this.bodyObserver.observe(document.body, { childList: true });
  }

  destroy(): void {
    this.bodyObserver?.disconnect();
    this.bodyObserver = null;
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    for (const [popover, state] of this.popovers) {
      state.observer.disconnect();
      for (const header of popover.querySelectorAll(".mdp-header")) {
        header.remove();
      }
    }
    this.popovers.clear();
  }

  private attach(popover: HTMLElement): void {
    const hover = this.lastHover;
    if (!hover || Date.now() - hover.time > HOVER_WINDOW) {
      return;
    }
    // O conteúdo chega aos poucos; cada mudança pede uma nova passada.
    const observer = new MutationObserver(() => {
      this.schedule();
    });
    observer.observe(popover, { childList: true, subtree: true });
    this.popovers.set(popover, { inserts: 0, observer, path: hover.path });
  }

  /** Agrupa as mudanças de DOM dos popovers numa passada por frame. */
  private schedule(): void {
    if (this.frame !== null) {
      return;
    }
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      for (const [popover, state] of this.popovers) {
        if (popover.isConnected) {
          this.sync(popover, state);
        } else {
          state.observer.disconnect();
          this.popovers.delete(popover);
        }
      }
    });
  }

  private sync(popover: HTMLElement, state: PopoverState): void {
    const { app } = this.plugin;
    const { path } = state;
    const file = app.vault.getFileByPath(path);
    if (!file) {
      return;
    }
    const data = dataFromFrontmatter(
      app.metadataCache.getFileCache(file)?.frontmatter
    );
    if (!data.cover && !data.icon) {
      return;
    }

    for (const mode of MODES) {
      const slot = findSlot(popover, mode);
      if (!slot) {
        continue;
      }
      let header = slot.scroller.querySelector<HTMLElement>(".mdp-header");
      if (!header || !isInPlace(header, mode, slot)) {
        if (state.inserts >= MAX_INSERTS) {
          continue;
        }
        state.inserts += 1;
        header?.remove();
        header = buildHeader(this.plugin, data, path, false);
        insertHeader(header, mode, slot);
      }
      bleed(header, slot.scroller);
    }
  }
}
