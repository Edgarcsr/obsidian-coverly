// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Stage, pop, t01 } from "../kit";
import { fonts, l } from "../theme";
import { Logo } from "../ui/Logo";

export const END_FRAMES = 96;

/** Cartão final: a marca dentro de uma pílula, num fundo liso. */
export const End = () => {
  const f = useCurrentFrame();
  const pill = pop(f, 6, 15);
  const sub = t01(f, 26, 40);
  return (
    <AbsoluteFill>
      <Stage color={l.bgAlt} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: fonts.ui }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 26,
            padding: "24px 52px 24px 28px",
            borderRadius: 999,
            background: l.card,
            border: `1.5px solid ${l.border}`,
            boxShadow: l.shadow,
            opacity: Math.min(1, pill * 1.4),
            filter: `blur(${(1 - Math.min(1, pill)) * 12}px)`,
            transform: `scale(${0.85 + 0.15 * pill})`,
          }}
        >
          <Logo size={96} />
          <span style={{ fontSize: 84, fontWeight: 700, letterSpacing: -2.5, color: l.text }}>Coverly</span>
        </div>
        <div style={{ marginTop: 44, fontSize: 32, color: l.muted, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)` }}>
          Settings → Community plugins → Coverly
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
