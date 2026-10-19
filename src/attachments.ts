/** Primeira imagem de uma lista de arquivos (colados ou arrastados). */
export const firstImage = (files: FileList | null | undefined): File | null =>
  [...(files ?? [])].find((file) => file.type.startsWith("image/")) ?? null;
