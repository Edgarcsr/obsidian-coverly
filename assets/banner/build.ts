// Inlines every local font, image and script that banner.src.html references (./fonts/*, ./games/*, ./albums/*,
// ./dither.js ...) into banner.html, so the result renders the same in any viewer, including previews that
// only show a static snapshot and cannot load sibling files.
// Usage (from the folder that holds banner.src.html): bun build.ts
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

let html = readFileSync("banner.src.html", "utf8");

html = html.replace(/<script src="\.\/([\w.-]+\.js)"><\/script>/g, (_, file: string) => `<script>${readFileSync(file, "utf8")}</script>`);

html = html.replace(/\.\/([\w-]+\/[\w.-]+\.(?:jpe?g|png|webp|svg|woff2))/g, (match, file: string) => {
  const mime = MIME[extname(file)];
  return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
});

writeFileSync("banner.html", html);
