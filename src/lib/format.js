// src/lib/format.js — shared money/time formatting.
// NOTE (DECISIONS.md): pulled forward by Dev1 so courts/juror pages can build
// before D2-0; this file follows the D2-0 spec exactly and is Dev2's to extend.
import JuriDAO from "./juridao-engine.js";

export function ethFromMicro(v) {
  return (v / 1000000).toFixed(4) + " ETH";
}
export function ethToMicro(eth) {
  return Math.round(eth * 1000000);
}
export function juri(v) {
  return Number(v || 0).toLocaleString("en-US");
}
export function mmss(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}
export function secondsUntil(state, t) {
  return Math.max(0, Math.floor(t - JuriDAO.nowOf(state)));
}
export function deadlineCountdown(state, t) {
  const s = secondsUntil(state, t);
  const days = Math.floor(s / 86400);
  if (days > 0) return `${days}d ${mmss(s % 86400)}`;
  return mmss(s);
}
