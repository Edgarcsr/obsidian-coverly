import { t } from "./i18n";

export interface ConfirmDeleteOptions {
  /** Nome do arquivo, mostrado na pergunta. */
  name: string;
  /** Quantas notas usam a imagem (ela é tirada delas ao excluir). */
  usage: number;
  onConfirm: () => Promise<void>;
}

/**
 * Pergunta "Excluir?" por cima do seletor, dentro dele. Um modal do Obsidian
 * ficaria fora do seletor, e tocar nele fecharia o seletor (que fecha ao
 * tocar fora).
 */
export const confirmDelete = (
  host: HTMLElement,
  options: ConfirmDeleteOptions
): void => {
  const overlay = host.createDiv({ cls: "mdp-confirm" });
  const card = overlay.createDiv({ cls: "mdp-confirm-card" });
  card.createDiv({ cls: "mdp-confirm-title", text: t("saved.confirmTitle") });
  card.createDiv({ cls: "mdp-confirm-name", text: options.name });
  card.createDiv({
    cls: "mdp-picker-hint",
    text:
      options.usage > 0
        ? t("saved.usedBy", { count: options.usage })
        : t("saved.unused"),
  });
  const actions = card.createDiv({ cls: "mdp-confirm-actions" });
  const cancel = actions.createEl("button", {
    cls: "mdp-picker-ghost",
    text: t("common.cancel"),
  });
  const confirm = actions.createEl("button", {
    cls: "mdp-confirm-delete",
    text: t("saved.delete"),
  });

  const controller = new AbortController();
  const dismiss = (): void => {
    controller.abort();
    overlay.remove();
  };
  // Na janela, antes do seletor: Esc fecha só a pergunta.
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }
    },
    { capture: true, signal: controller.signal }
  );
  cancel.addEventListener("click", dismiss);
  confirm.addEventListener("click", () => {
    confirm.disabled = true;
    void (async () => {
      await options.onConfirm();
      dismiss();
    })();
  });
  confirm.focus();
};
