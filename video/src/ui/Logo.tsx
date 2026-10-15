// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import type { CSSProperties } from "react";

/** Ícone exigido pelo catálogo da comunidade: quadrado roxo com um check. */
export const Logo = ({ size, style }: { size: number; style?: CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style} aria-label="Coverly">
    <defs>
      <linearGradient id="logo-bg" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stopColor="#9f7aea" />
        <stop offset="0.55" stopColor="#7444e0" />
        <stop offset="1" stopColor="#4c22b5" />
      </linearGradient>
      <linearGradient id="logo-shine" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="url(#logo-bg)" />
    <rect width="64" height="64" rx="16" fill="url(#logo-shine)" />
    <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="15.25" fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.5" />
    <path d="M20 33.5 28.5 42 45 23.5" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
