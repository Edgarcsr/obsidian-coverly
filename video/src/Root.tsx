// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import { Composition } from "remotion";

import { FPS, H, W } from "./kit";
import { CoverlyVideo, TOTAL_FRAMES } from "./Video";

export const Root = () => (
  <Composition id="Coverly" component={CoverlyVideo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
);
