// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { Camera, Stage, Words, cam } from "../kit";
import { fonts, l } from "../theme";

const Center = ({ children }: { children: React.ReactNode }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 160px" }}>{children}</AbsoluteFill>
);

export const HOOK_FRAMES = 84;

/** Abertura: frases curtas que entram palavra por palavra. */
export const Hook = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={44}>
      <Stage />
      <Camera keys={[cam(0, 1), cam(44, 1.08)]}>
        <Center>
          <Words text="Your notes deserve" start={2} exit={36} size={140} />
        </Center>
      </Camera>
    </Sequence>
    <Sequence from={44} durationInFrames={40}>
      <Stage color={l.bgAlt} />
      <Camera keys={[cam(0, 1.06), cam(40, 1)]}>
        <Center>
          <Words text="a beautiful page" start={0} exit={32} size={160} weight={700} highlight={["page"]} />
        </Center>
      </Camera>
    </Sequence>
  </AbsoluteFill>
);

export const TYPE_FRAMES = 50;
const TYPED = "Pick an icon";

/** Texto gigante sendo digitado, com o cursor de texto em roxo. */
export const TypeIcon = () => {
  const f = useCurrentFrame();
  const n = Math.min(TYPED.length, Math.max(0, Math.floor((f - 2) / 2.4)));
  const blink = n === TYPED.length && Math.floor(f / 8) % 2 === 1 ? 0 : 1;
  return (
    <AbsoluteFill>
      <Stage color={l.bgAlt} />
      <Camera keys={[cam(0, 1), cam(TYPE_FRAMES, 1.1, 900, 540)]}>
        <div
          style={{
            position: "absolute",
            left: 300,
            top: 420,
            display: "flex",
            alignItems: "center",
            fontFamily: fonts.ui,
            fontSize: 200,
            fontWeight: 500,
            letterSpacing: -6,
            color: l.text,
            whiteSpace: "pre",
          }}
        >
          {TYPED.slice(0, n)}
          <span style={{ width: 12, height: 200, marginLeft: 14, borderRadius: 3, background: l.accent, opacity: blink }} />
        </div>
      </Camera>
    </AbsoluteFill>
  );
};

export const TAGLINE_FRAMES = 50;

export const Tagline = () => (
  <AbsoluteFill>
    <Stage />
    <Camera keys={[cam(0, 1.04), cam(TAGLINE_FRAMES, 1)]}>
      <Center>
        <Words text="Make every note feel like a page." start={2} stagger={3} exit={42} size={124} highlight={["page."]} />
      </Center>
    </Camera>
  </AbsoluteFill>
);
