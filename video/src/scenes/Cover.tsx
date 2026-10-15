// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Camera, Cursor, Stage, Tag, cam, cursorAt, pop, t01 } from "../kit";
import { l } from "../theme";
import { CoverArt } from "../ui/CoverArt";
import type { CoverId } from "../ui/CoverArt";
import { ADD_BTNS, CARD_X, CARD_Y, NoteCard, addRowY } from "../ui/NoteCard";

export const COVER_FRAMES = 120;

const TRAY: CoverId[] = ["lavender", "ocean", "sunset", "dusk", "aurora", "forest"];
const SW = { w: 130, h: 88, gap: 18, y: 884 };
const swatchX = (i: number): number => 960 - (TRAY.length * SW.w + (TRAY.length - 1) * SW.gap) / 2 + i * (SW.w + SW.gap) + SW.w / 2;

/** Cliques nas amostras: [quadro, índice]. */
const PICKS: [number, number][] = [
  [72, 1],
  [88, 2],
  [104, 3],
];

const btn = ADD_BTNS[1] ?? { x: 0, w: 0 };
const ADD_COVER = { x: CARD_X + btn.x + btn.w / 2, y: CARD_Y + addRowY(0) + 22 };

export const Cover = () => {
  const f = useCurrentFrame();
  const click = 24;
  const cursor = cursorAt(
    [
      { f: 0, x: 1000, y: 560 },
      { f: 16, ...ADD_COVER },
      { f: 56, ...ADD_COVER },
      ...PICKS.flatMap(([at, i]) => [
        { f: at - 10, x: swatchX(i) + 10, y: SW.y + 10 },
        { f: at + 2, x: swatchX(i) + 10, y: SW.y + 10 },
      ]),
      { f: 120, x: 1500, y: 1060 },
    ],
    [click, ...PICKS.map(([at]) => at)],
    f
  );
  const current = PICKS.reduce((idx, [at, i]) => (f >= at ? i : idx), 0);
  const layers = TRAY.map((id, i) => {
    const pick = PICKS.find(([, idx]) => idx === i);
    const shownAt = i === 0 ? -1 : (pick?.[0] ?? 999);
    const nextPick = PICKS.find(([at]) => at > shownAt);
    const fadeIn = i === 0 ? 1 : t01(f, shownAt, shownAt + 8);
    const fadeOut = nextPick ? t01(f, nextPick[0] + 8, nextPick[0] + 9) : 0;
    return { id, opacity: fadeIn * (1 - fadeOut) };
  });
  const tray = Math.min(pop(f, 56, 16), 1 - t01(f, 110, 118));
  return (
    <AbsoluteFill>
      <Stage />
      <Camera keys={[cam(0, 2.6, ADD_COVER.x, ADD_COVER.y), cam(22, 2.6, ADD_COVER.x, ADD_COVER.y), cam(54, 0.92, 960, 590), cam(COVER_FRAMES, 0.95, 960, 590)]}>
        <NoteCard cover={pop(f, 30, 18)} covers={layers} addRow={1} pressed={Math.max(0, 1 - Math.abs(f - click - 2) / 5)} />
        <div
          style={{
            position: "absolute",
            left: swatchX(0) - SW.w / 2 - 22,
            top: SW.y - SW.h / 2 - 22,
            display: "flex",
            gap: SW.gap,
            padding: 22,
            borderRadius: 24,
            background: l.popover,
            border: `1px solid ${l.border}`,
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            opacity: Math.min(1, tray * 1.5),
            transform: `translateY(${(1 - tray) * 80}px)`,
          }}
        >
          {TRAY.map((id, i) => (
            <div
              key={id}
              style={{
                width: SW.w,
                height: SW.h,
                borderRadius: 14,
                position: "relative",
                overflow: "hidden",
                boxShadow: i === current ? `0 0 0 3px ${l.popover}, 0 0 0 6px ${l.accent}` : "none",
                transform: `scale(${i === current ? 1.04 : 1})`,
              }}
            >
              <CoverArt id={id} />
            </div>
          ))}
        </div>
        <Cursor {...cursor} />
      </Camera>
      {f > 50 && <Tag label="Page covers" desc="Colors, artworks, photos or your own images." at={52} />}
    </AbsoluteFill>
  );
};
