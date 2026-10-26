import { getIconIds } from "obsidian";

import extraData from "./lucide-extra.json";

/**
 * Ícones do Lucide que o Obsidian não traz: os mais novos que a versão dele
 * e os do Lucide Lab (ver scripts/build-lucide-extra.ts). Só são usados
 * quando o Obsidian não tem o ícone, então numa versão dele que já o traga,
 * vale o do Obsidian. Quem não quer mais que os do Obsidian desliga a opção
 * "Ícones Lucide extras" nas configurações. Guardam o mesmo valor das notas ("lucide:nome").
 */
const SVG_NS = "http://www.w3.org/2000/svg";
const OBSIDIAN_PREFIX = "lucide-";
const SIZE = "24";

const bodies = extraData as Record<string, string>;

/** Ligado nas configurações; desligado, só valem os ícones que o Obsidian traz. */
let enabled = false;

export const setLucideExtras = (value: boolean): void => {
  enabled = value;
};

let obsidianIds: Set<string> | null = null;
/** Os ícones já montados, para não ler o SVG de novo a cada desenho. */
const templates = new Map<string, SVGElement>();

export const obsidianHas = (name: string): boolean => {
  obsidianIds ??= new Set(getIconIds());
  return obsidianIds.has(`${OBSIDIAN_PREFIX}${name}`);
};

/** Quantos ícones o Obsidian não traz e o plugin pode acrescentar. */
export const extraLucideCount = (): number =>
  Object.keys(bodies).filter((name) => !obsidianHas(name)).length;

/** Nomes dos ícones extras, só os que o Obsidian realmente não tem. Vazio se a opção estiver desligada. */
export const extraLucideNames = (): string[] =>
  enabled ? Object.keys(bodies).filter((name) => !obsidianHas(name)) : [];

/** O <svg> do ícone, com os atributos que o `setIcon` do Obsidian põe. */
const buildSvg = (name: string, body: string): SVGElement => {
  const svg = document.createElementNS(SVG_NS, "svg");
  const attributes: Record<string, string> = {
    class: `svg-icon ${OBSIDIAN_PREFIX}${name}`,
    fill: "none",
    height: SIZE,
    stroke: "currentColor",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "stroke-width": "2",
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    width: SIZE,
    xmlns: SVG_NS,
  };
  for (const [key, value] of Object.entries(attributes)) {
    svg.setAttribute(key, value);
  }
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="${SVG_NS}">${body}</svg>`,
    "image/svg+xml"
  );
  for (const child of doc.documentElement.childNodes) {
    svg.append(document.importNode(child, true));
  }
  return svg;
};

/**
 * Desenha o ícone extra em `el`. Devolve `false` quando o nome não é de um
 * extra ou o Obsidian já tem o ícone; aí quem chama usa o do Obsidian.
 */
export const drawExtraLucide = (el: HTMLElement, name: string): boolean => {
  const body = bodies[name];
  if (!enabled || body === undefined || obsidianHas(name)) {
    return false;
  }
  let template = templates.get(name);
  if (!template) {
    template = buildSvg(name, body);
    templates.set(name, template);
  }
  el.replaceChildren(template.cloneNode(true));
  return true;
};
