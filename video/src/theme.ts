import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadLora } from "@remotion/google-fonts/Lora";

export const fonts = {
  ui: loadInter("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] }).fontFamily,
  serif: loadLora("normal", { weights: ["400", "600", "700"], subsets: ["latin"] }).fontFamily,
  mono: loadMono("normal", { weights: ["400", "600", "700"], subsets: ["latin"] }).fontFamily,
};

/** Visual do plugin: tema escuro, cores sólidas, sem gradientes. */
export const l = {
  bg: "#191919",
  bgAlt: "#141414",
  card: "#202020",
  topbar: "#1c1c1c",
  tab: "#2a2a2a",
  tile: "#2a2a2a",
  popover: "#252525",
  text: "#ececec",
  body: "#b3b3b3",
  muted: "#9b9b9b",
  faint: "#5a5a5a",
  line: "#2c2c2c",
  border: "#333333",
  tocLine: "#4a4a4a",
  shadow: "0 40px 100px rgba(0, 0, 0, 0.55)",
  /** Roxo da paleta "Notion colors": o único destaque do vídeo. */
  accent: "#8d5bc1",
  /** O mesmo roxo, mais claro, para texto sobre o fundo escuro. */
  accentText: "#a77fd6",
};

/** Paleta "Notion colors" do seletor de ícones (src/page-icon.ts). */
export const notion = {
  gray: "#9b9b9b",
  brown: "#aa755f",
  yellow: "#ca8e1b",
  orange: "#d87620",
  green: "#2d9964",
  blue: "#2e7cd1",
  purple: "#8d5bc1",
  pink: "#c94079",
  red: "#cd4945",
};

