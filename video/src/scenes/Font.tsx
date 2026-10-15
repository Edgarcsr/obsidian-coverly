// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Camera, Cursor, Stage, Tag, cam, cursorAt, easeInOut, pop, t01 } from "../kit";
import { fonts, l } from "../theme";

export const FONT_FRAMES = 90;

const DOC = { x: 220, y: 250, w: 1000, h: 560 };
const POP = { x: 1300, y: 340, w: 404, h: 236 };
const TILE = { w: 112, h: 136, gap: 12 };
const OPTIONS = [
  { label: "Default", family: fonts.ui },
  { label: "Serif", family: fonts.serif },
  { label: "Mono", family: fonts.mono },
];
const tileCenter = (i: number) => ({
  x: POP.x + 20 + i * (TILE.w + TILE.gap) + TILE.w / 2,
  y: POP.y + 70 + TILE.h / 2,
});
/** Cliques: [quadro, opção]. */
const CLICKS: [number, number][] = [
  [22, 1],
  [44, 2],
  [66, 1],
];
const WIPE = 12;

const Page = ({ family }: { family: string }) => (
  <div style={{ position: "absolute", inset: 0, padding: "64px 76px", fontFamily: family, color: l.text }}>
    <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: family === fonts.ui ? -2 : 0 }}>Kyoto trip</div>
    <div style={{ marginTop: 30, fontSize: 30, lineHeight: 1.6, color: l.body }}>
      Five slow days in Kyoto, mostly on foot. Temples in the morning, long lunches, and the night market after dark.
    </div>
    <div style={{ marginTop: 40, fontSize: 46, fontWeight: 700 }}>Itinerary</div>
    <div style={{ marginTop: 14, fontSize: 30, lineHeight: 1.7, color: l.body }}>
      • Higashiyama and Gion on day one
      <br />• Bamboo grove in Arashiyama on day two
    </div>
  </div>
);

/** A nota troca de fonte: a nova "varre" a antiga da esquerda para a direita. */
export const Font = () => {
  const f = useCurrentFrame();
  const cursor = cursorAt(
    [
      { f: 0, x: 1760, y: 980 },
      ...CLICKS.flatMap(([at, i]) => [
        { f: at - 12, x: tileCenter(i).x + 10, y: tileCenter(i).y + 20 },
        { f: at + 4, x: tileCenter(i).x + 10, y: tileCenter(i).y + 20 },
      ]),
      { f: FONT_FRAMES, x: 1780, y: 1000 },
    ],
    CLICKS.map(([at]) => at),
    f
  );
  const done = CLICKS.filter(([at]) => f >= at);
  const current = done.at(-1);
  const to = current?.[1] ?? 0;
  const from = done.length > 1 ? (done.at(-2)?.[1] ?? 0) : 0;
  const wipe = current ? t01(f, current[0], current[0] + WIPE, easeInOut) : 1;
  const wiping = current !== undefined && wipe > 0 && wipe < 1;
  const doc = pop(f, 0, 18);
  const popover = pop(f, 6, 15);
  return (
    <AbsoluteFill>
      <Stage />
      <Camera keys={[cam(0, 1.55, POP.x + POP.w / 2, POP.y + POP.h / 2), cam(26, 1.55, POP.x + POP.w / 2, POP.y + POP.h / 2), cam(44, 1, 960, 560), cam(FONT_FRAMES, 1.03, 960, 560)]}>
        <div
          style={{
            position: "absolute",
            left: DOC.x,
            top: DOC.y,
            width: DOC.w,
            height: DOC.h,
            borderRadius: 28,
            overflow: "hidden",
            background: l.card,
            border: `1px solid ${l.border}`,
            boxShadow: l.shadow,
            opacity: doc,
            transform: `translateY(${(1 - doc) * 40}px)`,
          }}
        >
          <div style={{ position: "absolute", inset: 0, opacity: 1 - wipe }}>
            <Page family={OPTIONS[from]?.family ?? fonts.ui} />
          </div>
          <div style={{ position: "absolute", inset: 0, background: l.card, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }}>
            <Page family={OPTIONS[to]?.family ?? fonts.ui} />
          </div>
          {wiping && (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${wipe * 100}%`, width: 4, marginLeft: -2, background: l.accent, boxShadow: `0 0 24px ${l.accent}` }} />
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: POP.x,
            top: POP.y,
            width: POP.w,
            height: POP.h,
            borderRadius: 20,
            background: l.popover,
            border: `1px solid ${l.border}`,
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            fontFamily: fonts.ui,
            opacity: Math.min(1, popover * 1.4),
            transform: `translateY(${(1 - popover) * 30}px) scale(${0.94 + 0.06 * popover})`,
          }}
        >
          <div style={{ padding: "22px 22px 0", fontSize: 22, color: l.muted }}>Font style</div>
          {OPTIONS.map((o, i) => {
            const on = i === to && (current !== undefined || i === 0);
            const bounce = current?.[1] === i ? pop(f, current[0], 10) : 1;
            return (
              <div
                key={o.label}
                style={{
                  position: "absolute",
                  left: 20 + i * (TILE.w + TILE.gap),
                  top: 70,
                  width: TILE.w,
                  height: TILE.h,
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: on ? "rgba(141,91,193,0.18)" : "rgba(255,255,255,0.03)",
                  border: `2px solid ${on ? l.accent : l.border}`,
                  transform: `scale(${0.92 + 0.08 * Math.min(bounce, 1.06)})`,
                }}
              >
                <span style={{ fontFamily: o.family, fontSize: 46, fontWeight: 600, color: l.text }}>Ag</span>
                <span style={{ fontSize: 18, color: on ? l.text : l.muted }}>{o.label}</span>
              </div>
            );
          })}
        </div>
        <Cursor {...cursor} />
      </Camera>
      <Tag label="Note font" desc="Theme font, serif or mono, for each note." at={4} />
    </AbsoluteFill>
  );
};
