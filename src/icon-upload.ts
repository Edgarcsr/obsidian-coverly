import { Notice, setIcon } from "obsidian";
import type { App } from "obsidian";

import { firstImage, saveImageAttachment } from "./attachments";
import { t } from "./i18n";
import { URL_PATTERN } from "./page-icon";

/** Imagem escolhida na aba, à espera de "Salvar". */
type Staged =
  | { kind: "file"; file: File; preview: string }
  | { kind: "link"; url: string };

export interface IconUploadContext {
  app: App;
  /** Nota dona do ícone; a imagem vai para a pasta de anexos dela. */
  sourcePath: string;
  pick: (value: string) => Promise<void>;
  close: () => void;
}

/** O que a aba deixa ligado e o seletor precisa desligar ao sair dela. */
export interface IconUploadHandle {
  /** Recebe o que for colado enquanto a aba está aberta. */
  onPaste: (event: ClipboardEvent) => void;
  /** Libera a prévia da imagem local da memória. */
  dispose: () => void;
}

/** Mostra um aviso e devolve a notificação, sem efeito colateral solto no chamador. */
const notify = (message: string): Notice => new Notice(message);

/**
 * Aba "Fazer upload": botão largo, Ctrl+V com imagem ou link, arrastar e
 * soltar, e Cancelar/Salvar no rodapé, como no Notion.
 */
export const renderIconUpload = (
  body: HTMLElement,
  context: IconUploadContext
): IconUploadHandle => {
  let staged: Staged | null = null;
  let preview: string | null = null;

  const setPreview = (url: string | null): void => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    preview = url;
  };

  const zone = body.createDiv({ cls: "mdp-icon-upload" });
  const choose = zone.createEl("button", { cls: "mdp-icon-upload-btn" });
  zone.createDiv({
    cls: "mdp-picker-hint",
    text: t("iconUpload.pasteHint"),
  });
  const input = zone.createEl("input", {
    attr: { accept: "image/*" },
    type: "file",
  });
  input.hide();

  const footer = body.createDiv({ cls: "mdp-icon-upload-footer" });
  const cancel = footer.createEl("button", {
    cls: "mdp-picker-ghost",
    text: t("common.cancel"),
  });
  const save = footer.createEl("button", {
    cls: "mdp-picker-primary is-accent",
    text: t("common.save"),
  });

  const render = (): void => {
    choose.empty();
    save.disabled = staged === null;
    const source = staged?.kind === "file" ? staged.preview : staged?.url;
    if (source) {
      choose.createEl("img", {
        attr: { alt: "", src: source },
        cls: "mdp-icon-upload-preview",
      });
      choose.createSpan({ text: t("iconUpload.change") });
      return;
    }
    setIcon(choose.createSpan({ cls: "mdp-icon-upload-icon" }), "image");
    choose.createSpan({ text: t("iconUpload.choose") });
  };

  const stageFile = (file: File): void => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    staged = { file, kind: "file", preview: url };
    render();
  };

  const stageLink = (url: string): void => {
    setPreview(null);
    staged = { kind: "link", url };
    render();
  };

  choose.addEventListener("click", () => {
    input.click();
  });
  input.addEventListener("change", () => {
    const file = firstImage(input.files);
    if (file) {
      stageFile(file);
    }
  });
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.addClass("is-over");
  });
  zone.addEventListener("dragleave", () => {
    zone.removeClass("is-over");
  });
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.removeClass("is-over");
    const file = firstImage(event.dataTransfer?.files);
    if (file) {
      stageFile(file);
    }
  });

  cancel.addEventListener("click", context.close);
  save.addEventListener("click", async () => {
    if (!staged) {
      return;
    }
    try {
      const value =
        staged.kind === "file"
          ? await saveImageAttachment(
              context.app,
              staged.file,
              context.sourcePath
            )
          : staged.url;
      await context.pick(value);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      notify(
        reason
          ? t("notice.saveFailedReason", { reason })
          : t("notice.saveFailed")
      );
    }
  });

  render();

  return {
    dispose: () => {
      setPreview(null);
    },
    onPaste: (event) => {
      const file = firstImage(event.clipboardData?.files);
      const text = event.clipboardData?.getData("text/plain").trim() ?? "";
      if (file) {
        event.preventDefault();
        stageFile(file);
      } else if (URL_PATTERN.test(text)) {
        event.preventDefault();
        stageLink(text);
      }
    },
  };
};
