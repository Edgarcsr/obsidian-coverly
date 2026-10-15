// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";

import { fonts, l } from "./theme";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

/** Saída rápida e pouso suave, o "expo out" dos vídeos de produto. */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0 → 1 entre os quadros `a` e `b`. */
export const t01 = (f: number, a: number, b: number, easing = easeOut): number =>
  interpolate(f, [a, b], [0, 1], { easing, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Mola que começa no quadro `at`. */
export const pop = (f: number, at: number, damping = 14, stiffness = 180): number =>
  spring({ frame: f - at, fps: FPS, config: { damping, stiffness, mass: 0.8 } });


type Key = { f: number; s: number; x: number; y: number };

/** Interpola uma lista de chaves (quadro → valores) com suavização. */
const keyAt = (keys: Key[], f: number): Key => {
  const next = keys.findIndex((k) => k.f > f);
  if (next === -1) {
    return keys.at(-1) ?? { f, s: 1, x: W / 2, y: H / 2 };
  }
  if (next === 0) {
    return keys[0] ?? { f, s: 1, x: W / 2, y: H / 2 };
  }
  const a = keys[next - 1] as Key;
  const b = keys[next] as Key;
  const t = t01(f, a.f, b.f, easeInOut);
  return { f, s: a.s + (b.s - a.s) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

/** Câmera: aproxima o ponto (x, y) da cena com zoom `s`. */
export const Camera = ({ keys, children }: { keys: Key[]; children: ReactNode }) => {
  const f = useCurrentFrame();
  const { s, x, y } = keyAt(keys, f);
  return (
    <AbsoluteFill
      style={{
        transformOrigin: "0 0",
        transform: `translate(${W / 2 - x * s}px, ${H / 2 - y * s}px) scale(${s})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const cam = (f: number, s: number, x = W / 2, y = H / 2): Key => ({ f, s, x, y });

/** Texto que entra palavra por palavra, subindo e desembaçando. */
export const Words = ({
  text,
  start = 0,
  stagger = 4,
  exit,
  size = 120,
  color = l.text,
  highlight = [],
  weight = 600,
  style,
}: {
  text: string;
  start?: number;
  stagger?: number;
  exit?: number;
  size?: number;
  color?: string;
  /** Palavras pintadas com o roxo de destaque. */
  highlight?: string[];
  weight?: number;
  style?: CSSProperties;
}) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  const out = exit === undefined ? 0 : t01(f, exit, exit + 8, easeInOut);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: `0 ${size * 0.26}px`,
        fontFamily: fonts.ui,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: -size * 0.03,
        lineHeight: 1.15,
        opacity: 1 - out,
        filter: `blur(${out * 16}px)`,
        transform: `scale(${1 + out * 0.06})`,
        ...style,
      }}
    >
      {words.map((word, i) => {
        const t = t01(f, start + i * stagger, start + i * stagger + 16);
        const paint: CSSProperties = { color: highlight.includes(word) ? l.accentText : color };
        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              paddingBottom: size * 0.08,
              opacity: t,
              filter: `blur(${(1 - t) * 14}px)`,
              transform: `translateY(${(1 - t) * size * 0.45}px)`,
              ...paint,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/** Fundo liso, na cor do tema escuro. */
export const Stage = ({ color = l.bg }: { color?: string }) => <AbsoluteFill style={{ background: color }} />;

/**
 * Entrada e saída de cada cena: chega com um zoom que desembaça e sai
 * crescendo um pouco, o que dá o "zoom através" entre os cortes.
 */
export const Shell = ({ frames, children }: { frames: number; children: ReactNode }) => {
  const f = useCurrentFrame();
  const inT = t01(f, 0, 10);
  const outT = t01(f, frames - 7, frames, easeInOut);
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${1.08 - 0.08 * inT + 0.06 * outT})`,
        filter: `blur(${(1 - inT) * 14 + outT * 14}px)`,
        opacity: Math.min(1, inT * 1.6) * (1 - outT * 0.6),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Etiqueta no topo da cena com o nome do recurso e uma linha explicando. */
export const Tag = ({ label, desc, at = 2 }: { label: string; desc?: string; at?: number }) => {
  const f = useCurrentFrame();
  const t = pop(f, at, 16);
  const d = t01(f, at + 6, at + 20);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        fontFamily: fonts.ui,
        zIndex: 40,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "11px 22px",
          borderRadius: 999,
          background: l.popover,
          border: `1px solid ${l.border}`,
          fontSize: 24,
          fontWeight: 500,
          color: l.text,
          opacity: Math.min(1, t * 1.5),
          transform: `translateY(${(1 - t) * -30}px)`,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 5, background: l.accent }} />
        {label}
      </div>
      {desc && (
        <div style={{ fontSize: 26, color: l.muted, opacity: d, transform: `translateY(${(1 - d) * 10}px)`, filter: `blur(${(1 - d) * 6}px)` }}>
          {desc}
        </div>
      )}
    </div>
  );
};

/** Cursor grande, com um anel roxo que se abre a cada clique. */
export const Cursor = ({
  x,
  y,
  press = 0,
  ripple = -1,
  opacity = 1,
}: {
  x: number;
  y: number;
  press?: number;
  ripple?: number;
  opacity?: number;
}) => (
  <div style={{ position: "absolute", left: x, top: y, opacity, zIndex: 60, pointerEvents: "none" }}>
    {ripple >= 0 && ripple < 16 && (
      <div
        style={{
          position: "absolute",
          left: -36,
          top: -36,
          width: 72,
          height: 72,
          borderRadius: 36,
          border: `4px solid ${l.accent}`,
          opacity: 1 - ripple / 16,
          transform: `scale(${0.3 + (ripple / 16) * 1.2})`,
        }}
      />
    )}
    <svg
      width="64"
      height="64"
      viewBox="0 0 32 32"
      style={{
        position: "absolute",
        left: -6,
        top: -4,
        transform: `scale(${1 - press * 0.18})`,
        transformOrigin: "6px 4px",
        filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.35))",
      }}
    >
      <path d="M6 4 L26 13 L17 16.5 L13.5 26 Z" fill="#fff" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  </div>
);

type CursorKey = { f: number; x: number; y: number };

/** Posição do cursor, o "aperto" e a idade do último clique. */
export const cursorAt = (keys: CursorKey[], clicks: number[], f: number) => {
  const next = keys.findIndex((k) => k.f > f);
  let x = keys.at(-1)?.x ?? 0;
  let y = keys.at(-1)?.y ?? 0;
  if (next === 0) {
    x = keys[0]?.x ?? 0;
    y = keys[0]?.y ?? 0;
  } else if (next > 0) {
    const a = keys[next - 1] as CursorKey;
    const b = keys[next] as CursorKey;
    const t = t01(f, a.f, b.f, easeInOut);
    x = a.x + (b.x - a.x) * t;
    y = a.y + (b.y - a.y) * t;
  }
  const press = Math.max(0, ...clicks.map((c) => 1 - Math.abs(f - c - 2) / 4));
  const last = clicks.filter((c) => c <= f).at(-1);
  return { x, y, press, ripple: last === undefined ? -1 : f - last };
};
