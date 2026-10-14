/**
 * Gera src/emoji-data.json a partir do emojibase (nomes e palavras-chave em
 * português, mais o nome em inglês) e mantém só os emojis que existem no
 * Twemoji, para que todos apareçam no estilo do X.
 *
 * Uso: bun scripts/build-emojis.ts
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import en from "emojibase-data/en/compact.json";
import pt from "emojibase-data/pt/compact.json";

import { twemojiCode } from "../src/twemoji-code";

/** Grupos do emojibase, na ordem do Unicode; o 2 ("component") fica de fora. */
const GROUPS = [0, 1, 3, 4, 5, 6, 7, 8, 9];

const TWEMOJI_DIR = path.join(
  import.meta.dir,
  "..",
  "node_modules",
  "@twemoji",
  "svg"
);

const englishLabel = new Map(en.map((entry) => [entry.hexcode, entry.label]));

const hasTwemoji = (emoji: string): boolean =>
  existsSync(path.join(TWEMOJI_DIR, `${twemojiCode(emoji)}.svg`));

let missing = 0;
const groups = GROUPS.map((group) =>
  pt
    .filter((entry) => entry.group === group)
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((entry) => {
      const ok = hasTwemoji(entry.unicode);
      if (!ok) {
        missing += 1;
      }
      return ok;
    })
    .map((entry) => {
      const keywords = new Set([
        entry.label,
        ...(entry.tags ?? []),
        englishLabel.get(entry.hexcode) ?? "",
      ]);
      // [emoji, nome mostrado na dica, texto usado pelo filtro]
      return [
        entry.unicode,
        entry.label,
        [...keywords].filter(Boolean).join(" "),
      ];
    })
);

const out = path.join(import.meta.dir, "..", "src", "emoji-data.json");
writeFileSync(out, `${JSON.stringify(groups)}\n`);
const total = groups.reduce((sum, group) => sum + group.length, 0);
console.log(`${total} emojis em ${out} (${missing} sem Twemoji, ignorados)`);
