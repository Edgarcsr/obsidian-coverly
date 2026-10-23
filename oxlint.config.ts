import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  // `design/` e `video/` guardam assets e projetos avulsos (banner, logos, vídeo), não o plugin.
  ignorePatterns: [...(core.ignorePatterns ?? []), "design/**", "video/**"],
});
