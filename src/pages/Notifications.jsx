import { Link } from "react-router-dom";
import { useState } from "react";
import { useJuri } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";

// SPEC 8.13 — newest first, read/unread in localStorage.
const KEY = "juri_notifications_read";
function loadRead() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); }
}
function saveRead(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch {}
}

export default function Notifications() {
  const { state, account } = useJuri();
  const notes = JuriDAO.notificationsFor(state, account);
  const [read, setRead] = useState(loadRead);

  const markRead = (n) => {
    const next = new Set(read);
    next.add(n.at + "|" + n.text);
    setRead(next);
    saveRead(next);
  };
  const markAll = () => {
    const next = new Set(read);
    notes.forEach((n) => next.add(n.at + "|" + n.text));
    setRead(next);
    saveRead(next);
  };

  return (
    <div className="max-w-3xl mx-auto px-3 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {notes.length > 0 && (
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-3 text-sm" onClick={markAll}>Mark all read</button>
        )}
      </div>
      {notes.length === 0 ? (
        <p className="mt-6 text-gray-400">Nothing here yet</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {notes.map((n, i) => {
            const id = n.at + "|" + n.text;
            const isRead = read.has(id);
            return (
              <li key={i} className={`rounded-xl border p-4 ${isRead ? "bg-[#1c1530] border-[#3a2f5a] text-gray-400" : "bg-[#221a3d] border-[#8b5cf6]"}`}>
                <Link to={n.link} onClick={() => markRead(n)} className="block">
                  <div className="text-sm">{n.text}</div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(n.at * 1000).toLocaleString()}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
