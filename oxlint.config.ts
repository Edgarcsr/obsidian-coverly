import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  // `design/` guarda assets e scripts avulsos (banner, logos), não o plugin.
  ignorePatterns: [...(core.ignorePatterns ?? []), "design/**"],
});
