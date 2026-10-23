import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import type { Text } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { MarkdownView, editorInfoField } from "obsidian";

import { iconPacksVersion } from "./icon-packs";
import { isIconTrimEnabled } from "./icon-trim";
import type CoverlyPlugin from "./main";
import { drawPageIcon } from "./page-icon";

/**
 * O ícone da nota ao lado de cada link para ela, como as menções do Notion:
 * "Scaffold de [[Flux]]" mostra a logo do Flux antes do nome. Vale no Live
 * Preview (um widget do CodeMirror antes do link) e na leitura (um elemento
 * antes do `<a>`). Só links do tipo wiki; embeds (`![[…]]`) ficam de fora.
 */

/** `[[nota]]`, `[[nota#título]]` e `[[nota|apelido]]`, sem o `!` de embed. */
const WIKILINK = /(?<!!)\[\[(?<target>[^[\]|#^]+)[^[\]|]*(?:\|[^[\]]*)?\]\]/gu;
const FENCE = /^\s*(?:```|~~~)/u;
const FRONTMATTER_MARK = /^---\s*$/u;
const BACKTICK = "`";

/** Ícone mostrado por caminho, para saber se uma mudança de ícone pede redesenho. */
const seenIcons = new Map<string, string>();

const refreshEffect = StateEffect.define<null>();

/** Ícone da nota para a qual `target` aponta, se ela existir e tiver um. */
const iconFor = (
  plugin: CoverlyPlugin,
  target: string,
  sourcePath: string
): string | undefined => {
  const file = plugin.app.metadataCache.getFirstLinkpathDest(
    target.trim(),
    sourcePath
  );
  if (!file) {
    return undefined;
  }
  const icon = plugin.noteIcon(file.path);
  seenIcons.set(file.path, icon ?? "");
  return icon;
};

/** Desenha o ícone do link: o mesmo do cabeçalho e do explorador. */
const drawLinkIcon = (plugin: CoverlyPlugin, icon: string): HTMLElement => {
  const el = createSpan({ cls: "mdp-link-icon" });
  drawPageIcon(plugin.app, el, icon, plugin.settings.twemoji);
  return el;
};

/** Muda quando o desenho do mesmo ícone precisa ser refeito (pacote carregado, opções). */
const drawKey = (plugin: CoverlyPlugin, icon: string): string =>
  `${icon}\n${iconPacksVersion()}\n${plugin.settings.twemoji}\n${isIconTrimEnabled()}`;

class LinkIconWidget extends WidgetType {
  private readonly plugin: CoverlyPlugin;
  private readonly icon: string;
  private readonly key: string;

  constructor(plugin: CoverlyPlugin, icon: string) {
    super();
    this.plugin = plugin;
    this.icon = icon;
    this.key = drawKey(plugin, icon);
  }

  override eq(other: LinkIconWidget): boolean {
    return other.key === this.key;
  }

  toDOM(): HTMLElement {
    return drawLinkIcon(this.plugin, this.icon);
  }

  // O CodeMirror chama como método; o widget não tem estado para consultar aqui.
  // oxlint-disable-next-line class-methods-use-this
  override ignoreEvent(): boolean {
    return true;
  }
}

/**
 * Linhas dentro de blocos de código ou das propriedades (frontmatter), onde
 * `[[…]]` é texto e não link. Só até `upTo`, e uma vez por versão do texto.
 */
let skipCache: { doc: Text; flags: boolean[]; upTo: number } | null = null;

const skippedLines = (doc: Text, upTo: number): boolean[] => {
  if (skipCache?.doc === doc && skipCache.upTo >= upTo) {
    return skipCache.flags;
  }
  const flags: boolean[] = [false];
  let inFence = false;
  let inFrontmatter = false;
  for (let number = 1; number <= Math.min(upTo, doc.lines); number += 1) {
    const { text } = doc.line(number);
    if (number === 1 && FRONTMATTER_MARK.test(text)) {
      inFrontmatter = true;
      flags.push(true);
    } else if (inFrontmatter) {
      flags.push(true);
      inFrontmatter = !FRONTMATTER_MARK.test(text);
    } else if (FENCE.test(text)) {
      inFence = !inFence;
      flags.push(true);
    } else {
      flags.push(inFence);
    }
  }
  skipCache = { doc, flags, upTo };
  return flags;
};

/** O link está dentro de `código` na mesma linha: número ímpar de crases antes dele. */
const insideInlineCode = (text: string, index: number): boolean =>
  text.slice(0, index).split(BACKTICK).length % 2 === 0;

const decorate = (view: EditorView, plugin: CoverlyPlugin): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>();
  const sourcePath = view.state.field(editorInfoField, false)?.file?.path;
  if (!(sourcePath && plugin.settings.linkIcons)) {
    return builder.finish();
  }
  const { doc } = view.state;
  const lastVisible = Math.max(
    ...view.visibleRanges.map((range) => doc.lineAt(range.to).number),
    1
  );
  const skipped = skippedLines(doc, lastVisible);
  let done = 0;
  for (const range of view.visibleRanges) {
    let number = Math.max(doc.lineAt(range.from).number, done + 1);
    const end = doc.lineAt(range.to).number;
    for (; number <= end; number += 1) {
      done = number;
      const line = doc.line(number);
      if (skipped[number]) {
        continue;
      }
      for (const match of line.text.matchAll(WIKILINK)) {
        const icon = iconFor(plugin, match.groups?.target ?? "", sourcePath);
        if (icon && !insideInlineCode(line.text, match.index)) {
          builder.add(
            line.from + match.index,
            line.from + match.index,
            Decoration.widget({
              side: -1,
              widget: new LinkIconWidget(plugin, icon),
            })
          );
        }
      }
    }
  }
  return builder.finish();
};

const linkIconExtension = (plugin: CoverlyPlugin) =>
  ViewPlugin.define(
    (view) => {
      const state = { decorations: decorate(view, plugin) };
      return {
        get decorations(): DecorationSet {
          return state.decorations;
        },
        update(update: ViewUpdate): void {
          const refreshed = update.transactions.some((transaction) =>
            transaction.effects.some((effect) => effect.is(refreshEffect))
          );
          if (update.docChanged || update.viewportChanged || refreshed) {
            state.decorations = decorate(update.view, plugin);
          }
        },
      };
    },
    { decorations: (value) => value.decorations }
  );

/** Link na leitura: o ícone vai antes do `<a>`, fora do sublinhado. */
const decorateReading = (
  plugin: CoverlyPlugin,
  el: HTMLElement,
  sourcePath: string
): void => {
  if (!plugin.settings.linkIcons) {
    return;
  }
  for (const link of el.querySelectorAll<HTMLAnchorElement>(
    "a.internal-link"
  )) {
    const [target = ""] = (link.dataset.href ?? "").split(/[#^]/u);
    const icon = target ? iconFor(plugin, target, sourcePath) : undefined;
    if (icon && !link.previousElementSibling?.hasClass("mdp-link-icon")) {
      link.before(drawLinkIcon(plugin, icon));
    }
  }
};

/** Redesenha os ícones dos links abertos, no editor e na leitura. */
export const refreshLinkIcons = (plugin: CoverlyPlugin): void => {
  for (const leaf of plugin.app.workspace.getLeavesOfType("markdown")) {
    const { view } = leaf;
    if (!(view instanceof MarkdownView)) {
      continue;
    }
    const { cm } = view.editor as unknown as { cm?: EditorView };
    cm?.dispatch({ effects: refreshEffect.of(null) });
    if (view.getMode() === "preview") {
      view.previewMode.rerender(true);
    }
  }
};

export const registerLinkIcons = (plugin: CoverlyPlugin): void => {
  plugin.registerEditorExtension(linkIconExtension(plugin));
  plugin.registerMarkdownPostProcessor((el, context) => {
    decorateReading(plugin, el, context.sourcePath);
  });
  // O ícone da nota mudou: os links que apontam para ela precisam do novo.
  plugin.registerEvent(
    plugin.app.metadataCache.on("changed", (file) => {
      const before = seenIcons.get(file.path);
      if (
        before !== undefined &&
        before !== (plugin.noteIcon(file.path) ?? "")
      ) {
        refreshLinkIcons(plugin);
      }
    })
  );
};
