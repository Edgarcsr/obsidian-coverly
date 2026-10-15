// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion";

import { Camera, Cursor, Stage, Tag, cam, cursorAt, pop, t01 } from "../kit";
import { fonts, l, notion } from "../theme";
import { Icon } from "../ui/icons";
import type { IconName } from "../ui/icons";

export const ACCENT_FRAMES = 72;
const DOTS = [notion.gray, notion.brown, notion.orange, notion.yellow, notion.green, notion.blue, l.accent, notion.pink];
const DOT = 72;
const dotX = (i: number): number => 960 - (DOTS.length * DOT + (DOTS.length - 1) * 28) / 2 + i * (DOT + 28) + DOT / 2;
const DOT_Y = 900;
const ACCENT_PICKS: [number, number][] = [
  [22, 3],
  [46, 7],
];

const Task = ({ done, accent, bump = 0, children }: { done: boolean; accent: string; bump?: number; children: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22, height: 70, fontSize: 38, color: done ? l.muted : l.text }}>
    <span style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: done ? accent : "transparent", border: done ? "none" : `3px solid ${l.faint}`, transform: `scale(${1 + bump * 0.22}) rotate(${bump * -8}deg)` }}>
      {done && <Icon name="check" size={26} color="#fff" strokeWidth={3.4} />}
    </span>
    <span style={{ textDecoration: done ? "line-through" : "none" }}>{children}</span>
  </div>
);

/** A cor de destaque da nota muda: links e checkboxes acompanham. */
export const Accent = () => {
  const f = useCurrentFrame();
  const cursor = cursorAt(
    [
      { f: 0, x: 1500, y: 1060 },
      ...ACCENT_PICKS.flatMap(([at, i]) => [
        { f: at - 12, x: dotX(i) + 12, y: DOT_Y + 14 },
        { f: at + 4, x: dotX(i) + 12, y: DOT_Y + 14 },
      ]),
      { f: ACCENT_FRAMES, x: 1600, y: 1000 },
    ],
    ACCENT_PICKS.map(([at]) => at),
    f
  );
  const accent = interpolateColors(
    f,
    [0, 22, 30, 46, 54],
    [l.accent, l.accent, notion.yellow, notion.yellow, notion.pink]
  );
  const selected = ACCENT_PICKS.reduce((idx, [at, i]) => (f >= at ? i : idx), 6);
  const bumpAt = (delay: number) => Math.max(0, ...ACCENT_PICKS.map(([at]) => Math.sin(t01(f, at + delay, at + delay + 12) * Math.PI)));
  const enter = pop(f, 0, 16);
  return (
    <AbsoluteFill>
      <Stage />
      <Camera keys={[cam(0, 1), cam(ACCENT_FRAMES, 1.05, 960, 600)]}>
        <div
          style={{
            position: "absolute",
            left: 410,
            top: 190,
            width: 1100,
            padding: "40px 64px",
            borderRadius: 28,
            background: l.card,
            border: `1px solid ${l.border}`,
            boxShadow: l.shadow,
            fontFamily: fonts.ui,
            opacity: enter,
            transform: `translateY(${(1 - enter) * 50}px)`,
          }}
        >
          <div style={{ fontSize: 50, fontWeight: 700, color: l.text, marginBottom: 14 }}>Itinerary</div>
          <Task done accent={accent} bump={bumpAt(0)}>Book the ryokan in Gion</Task>
          <Task done accent={accent} bump={bumpAt(3)}>Rail pass to Arashiyama</Task>
          <Task done={false} accent={accent}>Tea ceremony on Saturday</Task>
          <div style={{ marginTop: 18, fontSize: 34, color: l.body }}>
            Budget lives in{" "}
            <span style={{ color: accent, textDecoration: "underline", textUnderlineOffset: 8 }}>Japan budget</span>
          </div>
        </div>
        {DOTS.map((color, i) => {
          const t = pop(f, 4 + i * 1.5, 14);
          return (
            <span
              key={color}
              style={{
                position: "absolute",
                left: dotX(i) - DOT / 2,
                top: DOT_Y - DOT / 2,
                width: DOT,
                height: DOT,
                borderRadius: DOT / 2,
                background: color,
                boxShadow: i === selected ? `0 0 0 5px ${l.bg}, 0 0 0 9px ${color}` : "0 10px 24px rgba(0,0,0,0.4)",
                transform: `scale(${t * (i === selected ? 1.08 : 1)})`,
              }}
            />
          );
        })}
        <Cursor {...cursor} />
      </Camera>
      <Tag label="Accent color" desc="Links and checkboxes follow the note." at={2} />
    </AbsoluteFill>
  );
};

export const NAMES_FRAMES = 56;
const FILES: { name: string; icon: IconName; color: string }[] = [
  { name: "Kyoto trip", icon: "compass", color: notion.orange },
  { name: "Japan budget", icon: "leaf", color: notion.green },
  { name: "Lisbon weekend", icon: "plane", color: notion.blue },
  { name: "Books of 2026", icon: "bookOpen", color: notion.purple },
  { name: "Quotes", icon: "heart", color: notion.pink },
  { name: "Ideas", icon: "lightbulb", color: notion.yellow },
];

/** Nomes do explorador de arquivos ganhando cor, um por um. */
export const Names = () => {
  const f = useCurrentFrame();
  const enter = pop(f, 0, 16);
  return (
    <AbsoluteFill>
      <Stage />
      <Camera keys={[cam(0, 1.35, 960, 330), cam(36, 1), cam(NAMES_FRAMES, 1.02)]}>
        <div
          style={{
            position: "absolute",
            left: 960 - 340,
            top: 170,
            width: 680,
            padding: "34px 26px",
            borderRadius: 28,
            background: "#181818",
            border: `1px solid ${l.border}`,
            boxShadow: l.shadow,
            fontFamily: fonts.ui,
            opacity: enter,
          }}
        >
          <div style={{ padding: "0 16px 20px", fontSize: 22, fontWeight: 600, letterSpacing: 1.5, color: l.faint }}>TRAVEL JOURNAL</div>
          {FILES.map((file, i) => {
            const t = t01(f, 8 + i * 5, 18 + i * 5);
            const color = interpolateColors(t, [0, 1], [l.body, file.color]);
            return (
              <div key={file.name} style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 16px", borderRadius: 14, fontSize: 38, fontWeight: 500, color, background: i === 0 ? "rgba(255,255,255,0.05)" : "transparent" }}>
                <Icon name={file.icon} size={34} color={color} strokeWidth={2.2} />
                {file.name}
              </div>
            );
          })}
        </div>
      </Camera>
      <Tag label="Colored names" desc="Spot your notes at a glance in the file explorer." at={2} />
    </AbsoluteFill>
  );
};
