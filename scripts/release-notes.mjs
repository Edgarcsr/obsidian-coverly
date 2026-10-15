// Gera as notas da release a partir dos commits desde a tag anterior,
// agrupados pelo tipo do Conventional Commit (feat, fix...).
// Uso: node scripts/release-notes.mjs <versão> > notes.md
import { execFileSync } from "node:child_process";

const SECTIONS = [
  { title: "Features", types: ["feat"] },
  { title: "Fixes", types: ["fix"] },
  { title: "Improvements", types: ["perf", "refactor", "style"] },
  { title: "Documentation", types: ["docs"] },
];
const COMMIT_PATTERN = /^(?<type>\w+)(?:\([^)]*\))?!?:\s*(?<text>.+)$/u;
const VERSION_BUMP = /^chore(?:\([^)]*\))?:\s*bump version/iu;
const REPOSITORY = process.env.GITHUB_REPOSITORY ?? "edgarcsr/obsidian-coverly";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf-8" }).trim();

const version = process.argv.at(2);
if (!version) {
  throw new Error("Usage: node scripts/release-notes.mjs <version>");
}

// Tag mais recente que não seja a desta versão (ela ainda não existe no CI).
const previous = git("tag", "--sort=-creatordate")
  .split("\n")
  .find((tag) => tag && tag !== version);
const range = previous ? `${previous}..HEAD` : "HEAD";
const subjects = git("log", "--no-merges", "--format=%s", range)
  .split("\n")
  .filter((subject) => subject && !VERSION_BUMP.test(subject));

const grouped = new Map(SECTIONS.map((section) => [section, []]));
const other = [];
for (const subject of subjects) {
  const match = COMMIT_PATTERN.exec(subject);
  const type = match?.groups.type;
  const section = SECTIONS.find((candidate) => candidate.types.includes(type));
  if (section) {
    const { text } = match.groups;
    grouped.get(section).push(text.charAt(0).toUpperCase() + text.slice(1));
  } else if (type !== "chore") {
    other.push(subject);
  }
}

const lines = [];
for (const [section, items] of grouped) {
  if (items.length > 0) {
    lines.push(`## ${section.title}`, "", ...items.map((i) => `- ${i}`), "");
  }
}
if (other.length > 0) {
  lines.push("## Other changes", "", ...other.map((i) => `- ${i}`), "");
}
if (lines.length === 0) {
  lines.push("Maintenance release.", "");
}
if (previous) {
  lines.push(
    `**Full changelog**: https://github.com/${REPOSITORY}/compare/${previous}...${version}`
  );
}
process.stdout.write(`${lines.join("\n")}\n`);
