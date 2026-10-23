// Inlines every local font, image and script that banner.src.html references (./fonts/*, ./games/*, ./albums/*,
// ./dither.js ...) into banner.html, so the result renders the same in any viewer, including previews that
// only show a static snapshot and cannot load sibling files.
// Usage (from the folder that holds banner.src.html): bun build.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MIME: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

let html = readFileSync("banner.src.html", "utf-8");

html = html.replaceAll(/<script src="\.\/(?<file>[\w.-]+\.js)"><\/script>/gu, (_match, file: string) => `<script>${readFileSync(file, "utf-8")}</script>`);

html = html.replaceAll(/\.\/(?<file>[\w-]+\/[\w.-]+\.(?:jpe?g|png|webp|svg|woff2))/gu, (_match, file: string) => {
  const mime = MIME[path.extname(file)];
  return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
});

writeFileSync("banner.html", html);
