import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useJuri } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { ethFromMicro, juri } from "../lib/format.js";
import BuyJuriModal from "./BuyJuriModal.jsx";

const ACCOUNTS = ["admin", "sam", "deepa", "funder", "juror1", "juror2", "juror3", "juror4", "juror5", "juror6", "juror7"];
const NAV = [
  ["Home", "/"],
  ["Deals", "/deals"],
  ["Courts", "/courts"],
  ["My Cases", "/cases"],
  ["Rewards", "/rewards"],
  ["Guide", "/guide"],
];
const JUROR_PATHS = ["/juror", "/cases", "/rewards"];

export default function Header() {
  const { state, account, setAccount } = useJuri();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const acct = state.accounts[account];
  const notes = JuriDAO.notificationsFor(state, account);
  let readSet = new Set();
  try { readSet = new Set(JSON.parse(localStorage.getItem("juri_notifications_read") || "[]")); } catch {}
  const unread = notes.filter((n) => !readSet.has(n.at + "|" + n.text)).length;
  const mode = JUROR_PATHS.some((p) => location.pathname.startsWith(p)) ? "juror" : "deals";

  return (
    <header className="sticky top-0 z-30 bg-[#1c1530]/95 backdrop-blur border-b border-[#3a2f5a]">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 px-3 py-2">
        <Link to="/" className="font-bold text-[#8b5cf6] text-lg">JuriDAO</Link>
        <button className="md:hidden min-h-[44px] min-w-[44px] rounded-lg border border-[#3a2f5a] px-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">☰</button>
        <nav className={`${menuOpen ? "flex" : "hidden"} md:flex w-full md:w-auto flex-wrap gap-1 text-sm`}>
          {NAV.map(([label, to]) => (
            <Link key={to} to={to} onClick={() => setMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-[#0f0b1a]">{label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Link to="/notifications" className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#0f0b1a]" aria-label="Notifications">
            🔔
            {unread > 0 && <span className="absolute top-1 right-1 bg-[#8b5cf6] text-white text-[10px] rounded-full px-1.5">{unread}</span>}
          </Link>
          <select
            className="min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-2 text-sm"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            aria-label="Account"
          >
            {ACCOUNTS.map((id) => <option key={id} value={id}>{state.accounts[id].name}</option>)}
          </select>
          <div className="text-xs text-gray-300 leading-tight">
            <div>{ethFromMicro(acct.eth)}</div>
            <div>{juri(acct.juri)} JURI</div>
          </div>
          <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] text-white px-3 text-sm" onClick={() => setBuyOpen(true)}>Buy JURI</button>
          <div className="flex rounded-lg border border-[#3a2f5a] overflow-hidden text-xs">
            <button className={`min-h-[44px] px-3 ${mode === "deals" ? "bg-[#8b5cf6] text-white" : ""}`} onClick={() => navigate("/deals")}>Deals</button>
            <button className={`min-h-[44px] px-3 ${mode === "juror" ? "bg-[#8b5cf6] text-white" : ""}`} onClick={() => navigate("/juror")}>Juror</button>
          </div>
        </div>
      </div>
      <BuyJuriModal open={buyOpen} onClose={() => setBuyOpen(false)} />
    </header>
  );
}
