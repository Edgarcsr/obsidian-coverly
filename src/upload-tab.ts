import { Notice } from "obsidian";
import type { App } from "obsidian";

import { asyncListener } from "./async-listener";
import { saveImageAttachment } from "./attachments";
import { t } from "./i18n";
import { renderVaultImages } from "./vault-images";

export interface UploadTabOptions {
  app: App;
  /** Nota que recebe o anexo, para a pasta de anexos do Obsidian. */
  sourcePath: string;
  /** Valor atual, para marcar a imagem do vault selecionada. */
  current: string | undefined;
  /** Aplica o caminho escolhido (enviado agora ou já no vault). */
  pick: (path: string) => Promise<void>;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Erro desconhecido.";

/** Mostra um aviso e devolve a notificação, sem efeito colateral solto no chamador. */
const notify = (message: string): Notice => new Notice(message);

/** Salva a imagem como anexo da nota e a aplica. Também serve para colar (Ctrl+V). */
export const uploadImage = async (
  options: UploadTabOptions,
  file: File
): Promise<void> => {
  if (!file.type.startsWith("image/")) {
    notify(t("notice.chooseImage"));
    return;
  }
  try {
    const path = await saveImageAttachment(
      options.app,
      file,
      options.sourcePath
    );
    await options.pick(path);
  } catch (error) {
    notify(t("notice.saveFailedReason", { reason: errorMessage(error) }));
  }
};

/** Aba "Carregar": envio (botão ou arrastar) e, logo abaixo, as imagens do vault. */
export const renderUploadTab = (
  body: HTMLElement,
  options: UploadTabOptions
): void => {
  const zone = body.createDiv({ cls: "mdp-picker-upload" });
  const button = zone.createEl("button", {
    cls: "mdp-picker-primary",
    text: t("cover.uploadButton"),
  });
  zone.createDiv({
    cls: "mdp-picker-hint",
    text: t("cover.uploadHint"),
  });
  const input = zone.createEl("input", {
    attr: { accept: "image/*" },
    type: "file",
  });
  input.hide();

  button.addEventListener("click", () => {
    input.click();
  });
  input.addEventListener(
    "change",
    asyncListener(async () => {
      const file = input.files?.[0];
      if (file) {
        await uploadImage(options, file);
      }
    })
  );
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.addClass("is-over");
  });
  zone.addEventListener("dragleave", () => {
    zone.removeClass("is-over");
  });
  zone.addEventListener(
    "drop",
    asyncListener(async (event) => {
      event.preventDefault();
      zone.removeClass("is-over");
      const file = event.dataTransfer?.files[0];
      if (file) {
        await uploadImage(options, file);
      }
    })
  );

  body.createDiv({
    cls: "mdp-picker-section-title",
    text: t("vault.title"),
  });
  renderVaultImages(body, {
    app: options.app,
    current: options.current,
    pick: options.pick,
  });
};
