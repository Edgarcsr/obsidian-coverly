// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Camera, Cursor, Stage, Tag, cam, cursorAt, pop, t01 } from "../kit";
import { fonts, l, notion } from "../theme";
import { CARD_X, CARD_Y, CONTENT_X, COVER_H, ICON_SIZE, NoteCard, TOPBAR } from "../ui/NoteCard";
import { Icon } from "../ui/icons";
import type { IconName } from "../ui/icons";

export const GRID_FRAMES = 66;

const GRID: [IconName, string][] = [
  ["bookOpen", notion.purple], ["camera", notion.gray], ["coffee", notion.brown], ["sparkles", notion.yellow],
  ["heart", notion.pink], ["music", notion.blue], ["flame", notion.red], ["leaf", notion.green],
  ["rocket", notion.purple], ["star", notion.yellow], ["compass", notion.orange], ["plane", notion.blue],
  ["lightbulb", notion.yellow], ["mountain", notion.green], ["graduationCap", notion.gray], ["image", notion.pink],
  ["smile", notion.yellow], ["droplet", notion.blue], ["folder", notion.brown], ["fileText", notion.gray],
  ["search", notion.purple], ["type", notion.red], ["check", notion.green], ["flame", notion.orange],
];
const COLS = 8;
const TILE = 150;
const GAP = 24;
const GRID_X = 960 - (COLS * TILE + (COLS - 1) * GAP) / 2;
const GRID_Y = 540 - (3 * TILE + 2 * GAP) / 2 + 30;
const tileCenter = (i: number) => ({
  x: GRID_X + (i % COLS) * (TILE + GAP) + TILE / 2,
  y: GRID_Y + Math.floor(i / COLS) * (TILE + GAP) + TILE / 2,
});
const PICK = 10;

/** Grade de ícones que aparece em onda; o cursor escolhe a bússola. */
export const IconGrid = () => {
  const f = useCurrentFrame();
  const target = tileCenter(PICK);
  const cursor = cursorAt(
    [
      { f: 0, x: 1700, y: 1000 },
      { f: 18, x: 1700, y: 1000 },
      { f: 32, x: target.x + 20, y: target.y + 24 },
    ],
    [36],
    f
  );
  const chosen = t01(f, 38, 52);
  return (
    <AbsoluteFill>
      <Stage />
      <Camera keys={[cam(0, 1.12), cam(30, 1), cam(40, 1), cam(GRID_FRAMES, 1.5, target.x, target.y)]}>
        {GRID.map(([name, color], i) => {
          const c = tileCenter(i);
          const d = Math.hypot(c.x - 960, c.y - 540) / 120;
          const t = pop(f, d * 1.6, 13);
          const isPick = i === PICK;
          return (
            <div
              key={`${name}-${i}`}
              style={{
                position: "absolute",
                left: c.x - TILE / 2,
                top: c.y - TILE / 2,
                width: TILE,
                height: TILE,
                borderRadius: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: l.card,
                border: `1px solid ${isPick && chosen > 0 ? "transparent" : l.border}`,
                boxShadow: isPick && chosen > 0 ? `0 0 0 ${chosen * 4}px ${l.accent}, 0 20px 60px rgba(0,0,0,${chosen * 0.5})` : "0 16px 40px rgba(0,0,0,0.35)",
                opacity: Math.min(1, t * 1.4) * (isPick ? 1 : 1 - chosen * 0.75),
                transform: `scale(${t * (isPick ? 1 + chosen * 0.12 : 1)})`,
              }}
            >
              <Icon name={name} size={66} color={color} strokeWidth={2} />
            </div>
          );
        })}
        <Cursor {...cursor} />
      </Camera>
      <Tag label="Page icons" desc="Any emoji or Lucide icon, in the color you want." at={4} />
    </AbsoluteFill>
  );
};

export const LAND_FRAMES = 66;
const ICON_POINT = { x: CARD_X + CONTENT_X - 6 + ICON_SIZE / 2, y: CARD_Y + TOPBAR + COVER_H };

/** O ícone cai na nota e a câmera se afasta. */
export const IconLand = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Stage />
      <Camera keys={[cam(0, 2.4, ICON_POINT.x, ICON_POINT.y), cam(26, 2.4, ICON_POINT.x, ICON_POINT.y), cam(56, 1), cam(LAND_FRAMES, 1.02)]}>
        <NoteCard cover={1} covers={[{ id: "dusk", opacity: 1 }]} icon={pop(f, 4, 9, 150)} />
      </Camera>
    </AbsoluteFill>
  );
};

export const CHECK_FRAMES = 60;
const ROWS = ["Icon in the tab title", "Icon in the file explorer", "Saved in the note's frontmatter"];
const ROW_H = 92;

const Spinner = ({ f }: { f: number }) => (
  <svg width="34" height="34" viewBox="0 0 34 34" style={{ transform: `rotate(${f * 18}deg)` }}>
    <circle cx="17" cy="17" r="13" fill="none" stroke="#3a3744" strokeWidth="4" />
    <path d="M17 4 A13 13 0 0 1 30 17" fill="none" stroke="${l.accent}" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

/** Lista que vai se completando, como um "carregando → pronto". */
export const Checklist = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: l.bgAlt }} />
      <Camera keys={[cam(0, 1.18), cam(CHECK_FRAMES, 1)]}>
        <div
          style={{
            position: "absolute",
            left: 960 - 380,
            top: 540 - (ROWS.length * ROW_H) / 2,
            width: 760,
            borderRadius: 28,
            overflow: "hidden",
            background: l.card,
            border: `1px solid ${l.border}`,
            boxShadow: l.shadow,
            fontFamily: fonts.ui,
          }}
        >
          {ROWS.map((row, i) => {
            const appear = pop(f, i * 14, 16);
            const done = f >= i * 14 + 12;
            const check = pop(f, i * 14 + 12, 11);
            return (
              <div
                key={row}
                style={{
                  height: ROW_H * Math.min(1, appear),
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  padding: "0 34px",
                  borderTop: i ? `1px solid ${l.line}` : "none",
                  opacity: Math.min(1, appear * 1.3),
                  fontSize: 32,
                  color: done ? l.text : l.muted,
                }}
              >
                <div style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {done ? (
                    <span style={{ width: 34, height: 34, borderRadius: 17, background: l.accent, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${check})` }}>
                      <Icon name="check" size={20} color="#fff" strokeWidth={3.4} />
                    </span>
                  ) : (
                    <Spinner f={f} />
                  )}
                </div>
                {row}
              </div>
            );
          })}
        </div>
      </Camera>
    </AbsoluteFill>
  );
};
