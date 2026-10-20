import { Notice, setIcon } from "obsidian";
import type { App } from "obsidian";

import { firstImage } from "./attachments";
import { t } from "./i18n";
import { URL_PATTERN } from "./page-icon";
import { savePluginImage } from "./plugin-images";

export interface IconUploadContext {
  app: App;
  /** Nota dona do ícone; a imagem vai para a pasta de anexos dela. */
  sourcePath: string;
  pick: (value: string) => Promise<void>;
  /** Conteúdo extra abaixo da área de upload (as imagens do vault). */
  renderExtra?: (parent: HTMLElement) => void;
}

/** O que a aba deixa ligado ao seletor. */
export interface IconUploadHandle {
  /** Recebe o que for colado enquanto a aba está aberta. */
  onPaste: (event: ClipboardEvent) => void;
}

/** Mostra um aviso e devolve a notificação, sem efeito colateral solto no chamador. */
const notify = (message: string): Notice => new Notice(message);

/**
 * Aba "Fazer upload": botão largo, Ctrl+V com imagem ou link, e arrastar e
 * soltar. Escolher a imagem já a usa como ícone e fecha o seletor.
 */
export const renderIconUpload = (
  body: HTMLElement,
  context: IconUploadContext
): IconUploadHandle => {
  const zone = body.createDiv({ cls: "mdp-icon-upload" });
  const choose = zone.createEl("button", { cls: "mdp-icon-upload-btn" });
  setIcon(choose.createSpan({ cls: "mdp-icon-upload-icon" }), "image");
  choose.createSpan({ text: t("iconUpload.choose") });
  zone.createDiv({
    cls: "mdp-picker-hint",
    text: t("iconUpload.pasteHint"),
  });
  const input = zone.createEl("input", {
    attr: { accept: "image/*" },
    type: "file",
  });
  input.hide();

  context.renderExtra?.(body.createDiv({ cls: "mdp-icon-upload-extra" }));

  /** Salva a imagem (arquivo) ou usa o link, e aplica como ícone da nota. */
  const apply = async (source: File | string): Promise<void> => {
    try {
      const value =
        typeof source === "string"
          ? source
          : await savePluginImage(context.app, source, "icons");
      await context.pick(value);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      notify(
        reason
          ? t("notice.saveFailedReason", { reason })
          : t("notice.saveFailed")
      );
    }
  };

  choose.addEventListener("click", () => {
    input.click();
  });
  input.addEventListener("change", () => {
    const file = firstImage(input.files);
    if (file) {
      void apply(file);
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
      void apply(file);
    }
  });

  return {
    onPaste: (event) => {
      const file = firstImage(event.clipboardData?.files);
      const text = event.clipboardData?.getData("text/plain").trim() ?? "";
      if (file) {
        event.preventDefault();
        void apply(file);
      } else if (URL_PATTERN.test(text)) {
        event.preventDefault();
        void apply(text);
      }
    },
  };
};
