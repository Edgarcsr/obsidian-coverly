// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { Stage, pop } from "../kit";
import { fonts, l, notion } from "../theme";
import type { CoverId } from "../ui/CoverArt";
import { CARD_H, CARD_W, NoteCard } from "../ui/NoteCard";
import type { IconName } from "../ui/icons";

export const CAROUSEL_FRAMES = 84;

const NOTES: { title: string; cover: CoverId; icon: IconName; color: string; font: string }[] = [
  { title: "Garden log", cover: "forest", icon: "leaf", color: notion.green, font: fonts.mono },
  { title: "Reading list", cover: "lavender", icon: "bookOpen", color: notion.purple, font: fonts.ui },
  { title: "Kyoto trip", cover: "dusk", icon: "compass", color: notion.orange, font: fonts.serif },
  { title: "Lisbon weekend", cover: "ocean", icon: "plane", color: notion.blue, font: fonts.ui },
  { title: "Big ideas", cover: "space", icon: "lightbulb", color: notion.yellow, font: fonts.serif },
];
const STEP = 26;
const RADIUS = 1700;
const SCALE = 0.62;

/** Várias notas diferentes girando num arco 3D. */
export const Carousel = () => {
  const f = useCurrentFrame();
  const rot = interpolate(f, [0, CAROUSEL_FRAMES], [14, -14]);
  return (
    <AbsoluteFill>
      <Stage color={l.bgAlt} />
      <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: "50% 45%" }}>
        <div style={{ position: "absolute", left: 960, top: 540, transformStyle: "preserve-3d", transform: `translateZ(${-RADIUS}px) rotateY(${rot}deg)` }}>
          {NOTES.map((n, i) => {
            const angle = (i - 2) * STEP;
            const t = pop(f, Math.abs(i - 2) * 4, 15);
            return (
              <div
                key={n.title}
                style={{
                  position: "absolute",
                  width: CARD_W,
                  height: CARD_H,
                  left: -CARD_W / 2,
                  top: -CARD_H / 2,
                  opacity: Math.min(1, t * 1.4),
                  transform: `rotateY(${angle}deg) translateZ(${RADIUS + (1 - t) * 400}px) scale(${SCALE})`,
                }}
              >
                <NoteCard
                  cover={1}
                  covers={[{ id: n.cover, opacity: 1 }]}
                  icon={1}
                  iconName={n.icon}
                  iconColor={n.color}
                  font={n.font}
                  title={n.title}
                  style={{ left: 0, top: 0 }}
                />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
