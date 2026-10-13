import { StateField } from "@codemirror/state";
import type { EditorState, Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";

import { buildHeader } from "./header";
import type MdPlusPlugin from "./main";
import { dataFromFrontmatter, parseFrontmatterText } from "./note-data";
import type { CoverData } from "./note-data";

/** Só o começo do documento contém o frontmatter; não há motivo para ler a nota toda. */
const FRONTMATTER_WINDOW = 4000;

class HeaderWidget extends WidgetType {
  private readonly plugin: MdPlusPlugin;
  private readonly data: CoverData;
  private readonly sourcePath: string;

  constructor(plugin: MdPlusPlugin, data: CoverData, sourcePath: string) {
    super();
    this.plugin = plugin;
    this.data = data;
    this.sourcePath = sourcePath;
  }

  eq(other: HeaderWidget): boolean {
    return (
      other.sourcePath === this.sourcePath &&
      JSON.stringify(other.data) === JSON.stringify(this.data)
    );
  }

  toDOM(): HTMLElement {
    return buildHeader(this.plugin, this.data, this.sourcePath);
  }

  // O cabeçalho tem botões e arrasto próprios, então o CodeMirror não deve capturar os eventos.
  // oxlint-disable-next-line class-methods-use-this
  ignoreEvent(): boolean {
    return true;
  }
}

/**
 * Decoração de bloco no topo do documento. Decorações de bloco precisam vir de
 * um StateField (não de um ViewPlugin), por isso o campo é recalculado a cada
 * mudança no documento, que é o que mantém a capa em sincronia com o frontmatter.
 */
export const coverLivePreview = (plugin: MdPlusPlugin): Extension => {
  const build = (state: EditorState): DecorationSet => {
    const head = state.doc.sliceString(
      0,
      Math.min(state.doc.length, FRONTMATTER_WINDOW)
    );
    const data = dataFromFrontmatter(parseFrontmatterText(head));
    const sourcePath = plugin.app.workspace.getActiveFile()?.path ?? "";
    const widget = new HeaderWidget(plugin, data, sourcePath);
    return Decoration.set([
      Decoration.widget({ block: true, side: -1, widget }).range(0),
    ]);
  };

  return StateField.define<DecorationSet>({
    create: build,
    provide: (field) => EditorView.decorations.from(field),
    update: (value, transaction) =>
      transaction.docChanged ? build(transaction.state) : value,
  });
};
