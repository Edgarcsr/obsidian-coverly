// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Camera, Cursor, Stage, Tag, cam, cursorAt, easeInOut, pop, t01 } from "../kit";
import { fonts, l, notion } from "../theme";
import { CoverArt } from "../ui/CoverArt";
import { Icon } from "../ui/icons";
import { CARD_H, CARD_W, CARD_X, CARD_Y, TOPBAR } from "../ui/NoteCard";

export const OUTLINE_FRAMES = 112;

const HEADINGS = [
  { text: "Itinerary", depth: 1 },
  { text: "Day 1 · Higashiyama", depth: 2 },
  { text: "Day 2 · Arashiyama", depth: 2 },
  { text: "Food to try", depth: 1 },
  { text: "Packing", depth: 1 },
];
const TARGET = 3;
/** Onde cada título fica dentro do conteúdo da nota (que rola). */
const INTRO_H = 400;
const SECTION_H = 330;
const headingY = (i: number): number => INTRO_H + i * SECTION_H;
const VIEW_H = CARD_H - TOPBAR;

const PANEL = { w: 330, row: 50, right: 30, top: 200 };
const LINES = { right: 36, top: 230 };
const itemCenter = (i: number) => ({
  x: CARD_X + CARD_W - PANEL.right - PANEL.w / 2 + 20,
  y: CARD_Y + PANEL.top + 12 + i * PANEL.row + PANEL.row / 2,
});
const linesPoint = { x: CARD_X + CARD_W - LINES.right - 8, y: CARD_Y + LINES.top + 30 };

const CLICK = 58;
const SCROLL = { from: CLICK + 2, to: CLICK + 26 };

/** Seção da nota: título e alguns parágrafos (barras). */
const Section = ({ i, flash }: { i: number; flash: number }) => {
  const h = HEADINGS[i];
  if (!h) {
    return null;
  }
  return (
    <div style={{ position: "absolute", left: 120, right: 160, top: headingY(i) }}>
      <div
        style={{
          display: "inline-block",
          margin: "0 -14px",
          padding: "2px 14px",
          borderRadius: 10,
          fontSize: h.depth === 1 ? 46 : 36,
          fontWeight: 700,
          color: l.text,
          background: `rgba(141,91,193,${flash * 0.35})`,
        }}
      >
        {h.text}
      </div>
      {[94, 88, 97, 72, 84].slice(0, h.depth === 1 ? 5 : 4).map((w, k) => (
        <div key={w} style={{ width: `${w - k * 2}%`, height: 16, marginTop: k === 0 ? 30 : 22, borderRadius: 8, background: l.line }} />
      ))}
    </div>
  );
};

/** Nota longa: os traços na borda viram a lista de títulos, e o clique rola até o escolhido. */
export const Outline = () => {
  const f = useCurrentFrame();
  const cursor = cursorAt(
    [
      { f: 0, x: 1350, y: 860 },
      { f: 16, x: 1350, y: 860 },
      { f: 32, ...linesPoint },
      { f: 40, ...linesPoint },
      { f: 52, ...itemCenter(TARGET) },
      { f: 66, ...itemCenter(TARGET) },
      { f: 92, x: 1420, y: 980 },
    ],
    [CLICK],
    f
  );
  const scrollTarget = headingY(TARGET) - 40;
  const scroll = t01(f, SCROLL.from, SCROLL.to, easeInOut) * scrollTarget;
  const active = HEADINGS.reduce((acc, _, i) => (scroll + 120 >= headingY(i) ? i : acc), 0);
  const panel = Math.min(pop(f, 34, 16), 1 - t01(f, 68, 76));
  const flash = Math.sin(t01(f, SCROLL.to - 4, SCROLL.to + 22) * Math.PI);
  const enter = pop(f, 0, 18);
  return (
    <AbsoluteFill>
      <Stage />
      <Camera
        keys={[
          cam(0, 0.92, 960, 560),
          cam(16, 0.92, 960, 560),
          cam(36, 1.6, linesPoint.x - 170, linesPoint.y + 60),
          cam(CLICK + 4, 1.6, linesPoint.x - 170, linesPoint.y + 60),
          cam(CLICK + 26, 0.94, 960, 560),
          cam(OUTLINE_FRAMES, 0.96, 960, 560),
        ]}
      >
        <div
          style={{
            position: "absolute",
            left: CARD_X,
            top: CARD_Y,
            width: CARD_W,
            height: CARD_H,
            borderRadius: 28,
            overflow: "hidden",
            background: l.card,
            border: `1px solid ${l.border}`,
            boxShadow: l.shadow,
            fontFamily: fonts.ui,
            opacity: enter,
            transform: `translateY(${(1 - enter) * 40}px)`,
          }}
        >
          <div style={{ height: TOPBAR, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", borderBottom: `1px solid ${l.line}`, background: l.topbar }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 13, height: 13, borderRadius: 7, background: "#3a3a3a" }} />
            ))}
            <div style={{ marginLeft: 18, display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderRadius: 10, background: l.tab, fontSize: 18, color: l.text }}>
              <Icon name="compass" size={18} color={notion.orange} strokeWidth={2.4} />
              Kyoto trip
            </div>
          </div>
          <div style={{ position: "relative", height: VIEW_H, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: -scroll }}>
              <div style={{ position: "relative", height: 200, overflow: "hidden" }}>
                <CoverArt id="dusk" />
              </div>
              <div style={{ position: "absolute", left: 120, top: 250, fontSize: 64, fontWeight: 700, color: l.text, letterSpacing: -1.5 }}>Kyoto trip</div>
              {HEADINGS.map((h, i) => (
                <Section key={h.text} i={i} flash={i === TARGET ? flash : 0} />
              ))}
            </div>
            <div style={{ position: "absolute", right: LINES.right, top: LINES.top - TOPBAR, opacity: 1 - panel }}>
              {HEADINGS.map((h, i) => (
                <div
                  key={h.text}
                  style={{
                    width: h.depth === 1 ? 30 : 18,
                    height: 5,
                    marginBottom: 14,
                    marginLeft: h.depth === 1 ? 0 : 12,
                    borderRadius: 3,
                    background: i === active ? l.accent : l.tocLine,
                  }}
                />
              ))}
            </div>
          </div>
          {panel > 0.01 && (
            <div
              style={{
                position: "absolute",
                right: PANEL.right,
                top: PANEL.top,
                width: PANEL.w,
                padding: 12,
                borderRadius: 18,
                background: l.popover,
                border: `1px solid ${l.border}`,
                boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
                opacity: Math.min(1, panel * 1.4),
                transform: `translateX(${(1 - panel) * 40}px) scale(${0.94 + 0.06 * panel})`,
                transformOrigin: "right top",
                fontSize: 22,
              }}
            >
              {HEADINGS.map((h, i) => {
                const hover = i === TARGET && f >= 50;
                return (
                  <div
                    key={h.text}
                    style={{
                      height: PANEL.row,
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: h.depth === 1 ? 16 : 38,
                      borderRadius: 12,
                      background: hover ? "rgba(141,91,193,0.18)" : "transparent",
                      color: i === active || hover ? l.accentText : l.muted,
                      fontWeight: i === active || hover ? 600 : 400,
                    }}
                  >
                    {h.text}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <Cursor {...cursor} />
      </Camera>
      <Tag label="Heading outline" desc="Hover the edge of a long note to see its headings. Select one to jump there." at={4} />
    </AbsoluteFill>
  );
};
