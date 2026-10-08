// src/lib/store.js — single state owner for the JuriDAO simulator.
// One action = one engine call through act(); a 2-second keeper runs autoAdvance.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import JuriDAO from "./juridao-engine.js";

export const STATE_KEY = "juridao_state_v2";

export function loadState() {
  try {
    const raw = localStorage.getItem("juridao_state_v2");
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupted state -> fall through to a fresh one
  }
  return JuriDAO.createInitialState();
}

export function saveState(state) {
  try {
    localStorage.setItem("juridao_state_v2", JSON.stringify(state));
  } catch {
    // storage full or unavailable; keep going
  }
}

let state = loadState();
let account = "admin";
let version = 0;
const listeners = new Set();
let toasts = [];
let toastId = 0;
const toastListeners = new Set();

function emit() {
  version++;
  saveState(state);
  listeners.forEach((l) => l());
}

function emitToasts() {
  toastListeners.forEach((l) => l());
}

export function pushToast(text, kind = "info") {
  const id = ++toastId;
  toasts = [...toasts, { id, text, kind }];
  emitToasts();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emitToasts();
  }, 6000);
}

export function getToasts() {
  return toasts;
}

export function subscribeToasts(l) {
  toastListeners.add(l);
  return () => toastListeners.delete(l);
}

// Keeper replacement: run autoAdvance every 2 seconds, then save and re-render.
if (typeof window !== "undefined") {
  setInterval(() => {
    JuriDAO.autoAdvance(state);
    emit(); // re-render so countdowns tick; saveState runs inside emit
  }, 2000);

  window.JuriDAO = JuriDAO;
  window.juriState = () => state;
}

export function useJuri() {
  const subscribe = useCallback((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  useSyncExternalStore(subscribe, () => version);
  const boundAct = useCallback(
    (fn) => {
      try {
        const result = fn(state);
        emit();
        return result;
      } catch (e) {
        pushToast((e && e.message) || "Action failed", "error");
        return undefined;
      }
    },
    [account]
  );
  const setAccount = useCallback((id) => {
    account = id;
    version++;
    listeners.forEach((l) => l());
  }, []);
  return { state, account, setAccount, act: boundAct };
}

export function resetState() {
  state = JuriDAO.createInitialState();
  emit();
}

export function getState() {
  return state;
}
