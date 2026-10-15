// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import type { ComponentType } from "react";
import { AbsoluteFill, Series } from "remotion";

import { Shell } from "./kit";

import { CAROUSEL_FRAMES, Carousel } from "./scenes/Carousel";
import { COVER_FRAMES, Cover } from "./scenes/Cover";
import { END_FRAMES, End } from "./scenes/End";
import { CHECK_FRAMES, Checklist, GRID_FRAMES, IconGrid, IconLand, LAND_FRAMES } from "./scenes/Icons";
import { OUTLINE_FRAMES, Outline } from "./scenes/Outline";
import { FONT_FRAMES, Font } from "./scenes/Font";
import { ACCENT_FRAMES, Accent, NAMES_FRAMES, Names } from "./scenes/Style";
import { HOOK_FRAMES, Hook, TAGLINE_FRAMES, TYPE_FRAMES, Tagline, TypeIcon } from "./scenes/Text";

/** Cenas em ordem, com cortes secos entre elas. */
const SCENES: [ComponentType, number][] = [
  [Hook, HOOK_FRAMES],
  [Cover, COVER_FRAMES],
  [TypeIcon, TYPE_FRAMES],
  [IconGrid, GRID_FRAMES],
  [IconLand, LAND_FRAMES],
  [Checklist, CHECK_FRAMES],
  [Font, FONT_FRAMES],
  [Accent, ACCENT_FRAMES],
  [Names, NAMES_FRAMES],
  [Outline, OUTLINE_FRAMES],
  [Carousel, CAROUSEL_FRAMES],
  [Tagline, TAGLINE_FRAMES],
  [End, END_FRAMES],
];

export const TOTAL_FRAMES = SCENES.reduce((sum, [, frames]) => sum + frames, 0);

export const CoverlyVideo = () => (
  <AbsoluteFill style={{ background: "#141414" }}>
    <Series>
      {SCENES.map(([Scene, frames], i) => (
        <Series.Sequence key={i} durationInFrames={frames}>
          <Shell frames={frames}>
            <Scene />
          </Shell>
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
