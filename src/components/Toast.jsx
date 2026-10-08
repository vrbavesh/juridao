import { useSyncExternalStore } from "react";
import { getToasts, subscribeToasts } from "../lib/store.js";

export default function Toast() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-4 py-3 text-sm shadow-lg border ${
            t.kind === "error"
              ? "bg-red-950 border-red-500 text-red-200"
              : t.kind === "success"
              ? "bg-emerald-950 border-emerald-500 text-emerald-200"
              : "bg-[#1c1530] border-[#8b5cf6] text-gray-100"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
