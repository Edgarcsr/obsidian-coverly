import type { App } from "obsidian";

/**
 * Salva uma imagem como anexo da nota, na pasta de anexos configurada no
 * Obsidian, e devolve o caminho dela no vault.
 */
export const saveImageAttachment = async (
  app: App,
  file: File,
  sourcePath: string
): Promise<string> => {
  const path = await app.fileManager.getAvailablePathForAttachment(
    file.name,
    sourcePath
  );
  const created = await app.vault.createBinary(path, await file.arrayBuffer());
  return created.path;
};

/** Primeira imagem de uma lista de arquivos (colados ou arrastados). */
export const firstImage = (files: FileList | null | undefined): File | null =>
  [...(files ?? [])].find((file) => file.type.startsWith("image/")) ?? null;
