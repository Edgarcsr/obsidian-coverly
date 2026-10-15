// Remotion compila o JSX no modo clássico, que precisa do React em escopo.
import React from "react";
import type { CSSProperties } from "react";

import { fonts, l, notion } from "../theme";
import { CoverArt } from "./CoverArt";
import type { CoverId } from "./CoverArt";
import { Icon } from "./icons";
import type { IconName } from "./icons";

export const CARD_W = 1200;
export const CARD_H = 720;
export const CARD_X = (1920 - CARD_W) / 2;
export const CARD_Y = (1080 - CARD_H) / 2;
export const TOPBAR = 52;
export const COVER_H = 270;
export const CONTENT_X = 120;
export const ICON_SIZE = 110;

export const addRowY = (coverH: number): number => TOPBAR + coverH + 64;
export const titleY = (coverH: number): number => addRowY(coverH) + 62;

/** Botões acima do título: posição e largura dentro do cartão. */
export const ADD_BTNS = [
  { label: "Add icon", icon: "smile" as IconName, x: CONTENT_X, w: 156 },
  { label: "Add cover", icon: "image" as IconName, x: CONTENT_X + 166, w: 176 },
];

export const HEADINGS = ["Itinerary", "Day 1 · Higashiyama", "Day 2 · Arashiyama", "Food to try", "Packing"];
export const TOC_PANEL = { w: 300, row: 46, right: 28 };

export interface NoteProps {
  cover?: number;
  covers?: { id: CoverId; opacity: number }[];
  coverPan?: number;
  icon?: number;
  iconName?: IconName;
  iconColor?: string;
  font?: string;
  accent?: string;
  addRow?: number;
  pressed?: number;
  title?: string;
  toc?: number;
  tocActive?: number;
  style?: CSSProperties;
}


const Toc = ({ toc, active, accent }: { toc: number; active: number; accent: string }) => {
  const top = 330;
  return (
    <>
      <div style={{ position: "absolute", right: 34, top: top + 12, opacity: 1 - toc }}>
        {HEADINGS.map((h, i) => (
          <div
            key={h}
            style={{
              width: i === 1 || i === 2 ? 14 : 24,
              height: 4,
              marginBottom: 12,
              marginLeft: i === 1 || i === 2 ? 10 : 0,
              borderRadius: 2,
              background: i === Math.round(active) ? accent : l.tocLine,
            }}
          />
        ))}
      </div>
      {toc > 0.01 && (
        <div
          style={{
            position: "absolute",
            right: TOC_PANEL.right,
            top,
            width: TOC_PANEL.w,
            padding: 10,
            borderRadius: 16,
            background: l.popover,
            border: `1px solid ${l.border}`,
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            opacity: Math.min(1, toc * 1.4),
            transform: `translateX(${(1 - toc) * 40}px) scale(${0.94 + 0.06 * toc})`,
            transformOrigin: "right top",
            fontFamily: fonts.ui,
            fontSize: 20,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              top: 10 + active * TOC_PANEL.row,
              height: TOC_PANEL.row,
              borderRadius: 10,
              background: "rgba(141,91,193,0.18)",
            }}
          />
          {HEADINGS.map((h, i) => (
            <div
              key={h}
              style={{
                position: "relative",
                height: TOC_PANEL.row,
                display: "flex",
                alignItems: "center",
                paddingLeft: i === 1 || i === 2 ? 34 : 16,
                color: i === Math.round(active) ? accent : l.muted,
                fontWeight: i === Math.round(active) ? 600 : 400,
              }}
            >
              {h}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export const NoteCard = ({
  cover = 0,
  covers = [],
  coverPan = 0,
  icon = 0,
  iconName = "compass",
  iconColor = notion.orange,
  font = fonts.ui,
  accent = l.accent,
  addRow = 0,
  pressed = 0,
  title = "Kyoto trip",
  toc,
  tocActive = 0,
  style,
}: NoteProps) => {
  const coverH = COVER_H * cover;
  return (
    <div
      style={{
        position: "absolute",
        left: CARD_X,
        top: CARD_Y,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 28,
        overflow: "hidden",
        background: l.card,
        boxShadow: l.shadow,
        border: `1px solid ${l.border}`,
        fontFamily: fonts.ui,
        ...style,
      }}
    >
      <div style={{ height: TOPBAR, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", borderBottom: `1px solid ${l.line}`, background: l.topbar }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 13, height: 13, borderRadius: 7, background: "#e3e0ec" }} />
        ))}
        <div style={{ marginLeft: 18, display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderRadius: 10, background: l.tab, border: `1px solid ${l.line}`, fontSize: 18, color: l.text }}>
          {icon > 0.5 ? <Icon name={iconName} size={18} color={iconColor} strokeWidth={2.4} /> : <Icon name="fileText" size={18} color={l.faint} />}
          {title}
        </div>
      </div>
      <div style={{ position: "relative", height: coverH, overflow: "hidden" }}>
        {covers.map((c, i) => (
          <div key={`${c.id}-${i}`} style={{ position: "absolute", inset: 0, height: COVER_H, opacity: c.opacity }}><CoverArt id={c.id} pan={coverPan} /></div>
        ))}
      </div>
      {icon > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: CONTENT_X - 6,
            top: TOPBAR + coverH - ICON_SIZE / 2,
            width: ICON_SIZE,
            height: ICON_SIZE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 26,
            background: l.tile,
            boxShadow: "0 14px 34px rgba(0,0,0,0.45)",
            transform: `scale(${icon})`,
          }}
        >
          <Icon name={iconName} size={70} color={iconColor} strokeWidth={2} />
        </div>
      )}
      <div style={{ position: "absolute", left: 0, top: addRowY(coverH), opacity: addRow }}>
        {ADD_BTNS.map((b, i) => (
          <div
            key={b.label}
            style={{
              position: "absolute",
              left: b.x,
              width: b.w,
              height: 44,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 14px",
              borderRadius: 12,
              fontSize: 20,
              whiteSpace: "nowrap",
              color: i === 1 && pressed > 0 ? l.text : l.muted,
              background: i === 1 && pressed > 0 ? `rgba(141,91,193,${0.12 + pressed * 0.14})` : "transparent",
              transform: `scale(${1 - (i === 1 ? pressed : 0) * 0.06})`,
            }}
          >
            <Icon name={b.icon} size={20} color={l.muted} />
            {b.label}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: CONTENT_X, top: titleY(coverH), width: 860, fontFamily: font }}>
        <div style={{ fontSize: 64, lineHeight: 1.1, fontWeight: 700, color: l.text, letterSpacing: font === fonts.ui ? -1.5 : 0 }}>{title}</div>
        <div style={{ marginTop: 22, fontSize: 25, lineHeight: 1.6, color: l.body }}>
          Five slow days in Kyoto, mostly on foot. The numbers live in{" "}
          <span style={{ color: accent, textDecoration: "underline", textUnderlineOffset: 5 }}>Japan budget</span>.
        </div>
        {[92, 78, 86].map((w) => (
          <div key={w} style={{ width: `${w}%`, height: 14, marginTop: 22, borderRadius: 7, background: l.line }} />
        ))}
      </div>
      {toc !== undefined && <Toc toc={toc} active={tocActive} accent={accent} />}
    </div>
  );
};
