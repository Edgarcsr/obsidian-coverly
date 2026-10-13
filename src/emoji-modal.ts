import type { App } from "obsidian";
import { Modal } from "obsidian";

interface EmojiGroup {
  name: string;
  emojis: string[];
}

const GROUPS: EmojiGroup[] = [
  {
    emojis: [
      "📝",
      "📄",
      "📒",
      "📓",
      "📔",
      "📕",
      "📖",
      "🗒️",
      "🗂️",
      "📌",
      "📎",
      "🔖",
      "🏷️",
      "📚",
      "🗃️",
      "✏️",
    ],
    name: "Notas",
  },
  {
    emojis: [
      "💡",
      "🎯",
      "🚀",
      "⭐",
      "✨",
      "🔥",
      "🧠",
      "🌱",
      "🧭",
      "🗺️",
      "🔍",
      "⚡",
      "🎨",
      "🧩",
      "🪄",
      "💎",
    ],
    name: "Ideias",
  },
  {
    emojis: [
      "💼",
      "📊",
      "📈",
      "📅",
      "🗓️",
      "⏰",
      "✅",
      "☑️",
      "📋",
      "🧾",
      "💰",
      "🛠️",
      "⚙️",
      "🔧",
      "📦",
      "🏗️",
    ],
    name: "Trabalho",
  },
  {
    emojis: [
      "🌍",
      "🌎",
      "🌳",
      "🌸",
      "🌻",
      "🍀",
      "🌊",
      "🏔️",
      "🌙",
      "☀️",
      "🌈",
      "❄️",
      "🐶",
      "🐱",
      "🦊",
      "🦉",
    ],
    name: "Natureza",
  },
  {
    emojis: [
      "🙂",
      "😎",
      "🤔",
      "🥳",
      "🧑‍💻",
      "👩‍🎨",
      "👨‍🍳",
      "🧘",
      "🏃",
      "🎓",
      "❤️",
      "🫶",
      "🙏",
      "👀",
      "🤝",
      "💪",
    ],
    name: "Pessoas",
  },
  {
    emojis: [
      "☕",
      "🍵",
      "🍎",
      "🍕",
      "🍰",
      "🍷",
      "🎵",
      "🎬",
      "🎮",
      "📷",
      "✈️",
      "🏖️",
      "🏠",
      "🛏️",
      "🎁",
      "🎉",
    ],
    name: "Comida e lazer",
  },
];

export class EmojiModal extends Modal {
  private readonly onPick: (emoji: string | null) => void;

  constructor(app: App, onPick: (emoji: string | null) => void) {
    super(app);
    this.onPick = onPick;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("mdp-emoji-modal");
    contentEl.empty();

    const remove = contentEl.createEl("button", {
      cls: "mdp-emoji-remove",
      text: "Remover ícone",
    });
    remove.addEventListener("click", () => {
      this.choose(null);
    });

    for (const group of GROUPS) {
      contentEl.createDiv({ cls: "mdp-emoji-group-title", text: group.name });
      const grid = contentEl.createDiv({ cls: "mdp-emoji-grid" });
      for (const emoji of group.emojis) {
        const button = grid.createEl("button", {
          attr: { "aria-label": emoji },
          cls: "mdp-emoji-option",
          text: emoji,
        });
        button.addEventListener("click", () => {
          this.choose(emoji);
        });
      }
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private choose(emoji: string | null): void {
    this.onPick(emoji);
    this.close();
  }
}
