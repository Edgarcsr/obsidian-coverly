// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";

/** Capas ilustradas (SVG), cada uma com um movimento leve próprio. */
export type CoverId = "dusk" | "aurora" | "ocean" | "sunset" | "forest" | "space" | "lavender" | "dunes";

const Sky = ({ id, stops }: { id: string; stops: [number, string][] }) => (
  <>
    <defs>
      <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
        {stops.map(([o, c]) => (
          <stop key={o} offset={o} stopColor={c} />
        ))}
      </linearGradient>
    </defs>
    <rect width="1200" height="270" fill={`url(#sky-${id})`} />
  </>
);

const Stars = ({ f, count = 40, seed = 1 }: { f: number; count?: number; seed?: number }) => (
  <>
    {Array.from({ length: count }, (_, i) => {
      const x = (i * 263 * seed) % 1200;
      const y = (i * 97 * seed) % 170;
      const tw = 0.35 + 0.35 * Math.sin(f / 9 + i);
      return <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 1.8 : 1.1} fill="#fff" opacity={tw} />;
    })}
  </>
);

const ART: Record<CoverId, (f: number) => ReactNode> = {
  dusk: (f) => (
    <>
      <Sky id="dusk" stops={[[0, "#1f3b63"], [0.55, "#8a6f86"], [1, "#e9ad84"]]} />
      <circle cx="880" cy={118 - f * 0.08} r="120" fill="#ffd9b8" opacity="0.16" />
      <circle cx="880" cy={118 - f * 0.08} r="38" fill="#ffe6cc" />
      <path d="M0 270V170C140 120 260 160 420 128C560 100 700 70 900 110C1020 132 1110 112 1200 100V270Z" fill="#4a4f78" />
      <path d="M0 270V205C170 170 330 215 520 188C700 162 880 150 1200 182V270Z" fill="#323a60" />
      <path d="M0 270V242C220 222 430 256 660 234C860 216 1010 226 1200 238V270Z" fill="#1f2645" />
    </>
  ),
  aurora: (f) => (
    <>
      <Sky id="aurora" stops={[[0, "#06111f"], [1, "#0f2c3f"]]} />
      <Stars f={f} />
      <defs>
        <linearGradient id="aurora-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38f9d7" stopOpacity="0" />
          <stop offset="0.5" stopColor="#43e97b" stopOpacity="0.85" />
          <stop offset="1" stopColor="#38f9d7" stopOpacity="0" />
        </linearGradient>
        <filter id="aurora-blur">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>
      {[0, 1, 2].map((i) => {
        const p = f / 14 + i * 2;
        const d = `M-50 ${110 + i * 18} C 250 ${40 + Math.sin(p) * 40} 500 ${170 + Math.cos(p) * 30} 760 ${90 + Math.sin(p * 1.3) * 35} S 1150 ${60 + i * 20} 1260 ${120 - i * 10}`;
        return <path key={i} d={d} stroke="url(#aurora-band)" strokeWidth={70 - i * 16} fill="none" filter="url(#aurora-blur)" opacity={0.75 - i * 0.15} />;
      })}
      <path d="M0 270V214C200 190 380 226 600 204C820 182 1000 196 1200 210V270Z" fill="#05101a" />
    </>
  ),
  ocean: (f) => (
    <>
      <Sky id="ocean" stops={[[0, "#9fc3f9"], [0.55, "#d6ecfb"], [0.551, "#3d8fd6"], [1, "#1b4f8a"]]} />
      <ellipse cx="860" cy="149" rx="60" ry="5" fill="#fff" opacity="0.5" />
      <circle cx="860" cy="98" r="30" fill="#fff7e6" />
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 170 + i * 20;
        const off = ((f * (1.4 + i * 0.3)) % 200) - 200;
        return (
          <path
            key={i}
            d={`M${off} ${y} q 25 -6 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0`}
            stroke="#fff"
            strokeOpacity={0.28 - i * 0.04}
            strokeWidth="2.5"
            fill="none"
          />
        );
      })}
    </>
  ),
  sunset: (f) => (
    <>
      <Sky id="sunset" stops={[[0, "#4b2a7b"], [0.45, "#d9537c"], [0.72, "#f8a46b"], [0.721, "#3b2350"], [1, "#22142f"]]} />
      <circle cx="600" cy={196 - f * 0.12} r="74" fill="#ffd59a" />
      <rect x="0" y="194" width="1200" height="76" fill="#2a1840" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={600 - 70 + i * 12} y={206 + i * 14} width={140 - i * 24} height="4" rx="2" fill="#ffd59a" opacity={0.6 - i * 0.12} />
      ))}
    </>
  ),
  forest: () => (
    <>
      <Sky id="forest" stops={[[0, "#e3f3ea"], [1, "#9fd3b5"]]} />
      {[
        { y: 175, h: 90, c: "#6fae8a", n: 18 },
        { y: 205, h: 110, c: "#3f7e5f", n: 14 },
        { y: 240, h: 130, c: "#21503b", n: 11 },
      ].map((row, r) => (
        <g key={r}>
          {Array.from({ length: row.n }, (_, i) => {
            const w = 1200 / (row.n - 1);
            const x = i * w + (r % 2 ? w / 2 : 0) - 30;
            const h = row.h * (0.75 + ((i * 37) % 10) / 30);
            return <path key={i} d={`M${x} ${row.y - h} L${x + h * 0.38} ${row.y + 20} L${x - h * 0.38} ${row.y + 20}Z`} fill={row.c} />;
          })}
          <rect x="0" y={row.y + 18} width="1200" height="120" fill={row.c} />
        </g>
      ))}
    </>
  ),
  space: (f) => (
    <>
      <Sky id="space" stops={[[0, "#120b2e"], [1, "#3b1660"]]} />
      <defs>
        <filter id="space-blur">
          <feGaussianBlur stdDeviation="30" />
        </filter>
      </defs>
      <ellipse cx={420 + Math.sin(f / 30) * 20} cy="130" rx="260" ry="70" fill="#c94079" opacity="0.45" filter="url(#space-blur)" />
      <ellipse cx={760 - Math.sin(f / 30) * 20} cy="110" rx="240" ry="80" fill="#2e7cd1" opacity="0.45" filter="url(#space-blur)" />
      <Stars f={f} count={60} seed={3} />
      <circle cx="960" cy="200" r="54" fill="#e7c9ff" />
      <circle cx="944" cy="188" r="54" fill="#3b1660" opacity="0.55" />
    </>
  ),
  lavender: (f) => (
    <>
      <Sky id="lavender" stops={[[0, "#e0c3fc"], [1, "#8ec5fc"]]} />
      <defs>
        <filter id="cloud-blur">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <ellipse
          key={i}
          cx={((i * 360 + f * (1 + i * 0.4)) % 1500) - 150}
          cy={60 + (i % 2) * 90}
          rx={140 + i * 20}
          ry={30 + i * 4}
          fill="#fff"
          opacity="0.55"
          filter="url(#cloud-blur)"
        />
      ))}
    </>
  ),
  dunes: () => (
    <>
      <Sky id="dunes" stops={[[0, "#f6d365"], [1, "#fda085"]]} />
      <circle cx="300" cy="90" r="40" fill="#fff4d6" />
      <path d="M0 270V180C200 140 400 200 620 160C820 124 1000 150 1200 130V270Z" fill="#e8925c" />
      <path d="M0 270V220C260 190 480 236 760 206C960 186 1080 200 1200 196V270Z" fill="#cc6f45" />
    </>
  ),
};

export const CoverArt = ({ id, pan = 0 }: { id: CoverId; pan?: number }) => {
  const f = useCurrentFrame();
  return (
    <svg viewBox="0 0 1200 270" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: `translateY(${pan}px)` }}>
      {ART[id](f)}
    </svg>
  );
};
