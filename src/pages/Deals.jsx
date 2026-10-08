import { Link, useNavigate } from "react-router-dom";
import { useJuri } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { ethFromMicro } from "../lib/format.js";
import EmptyState from "../components/EmptyState.jsx";
import DealCard, { dealActionTag } from "../components/DealCard.jsx";

// SPEC 8.2 — Deals list. Stat cards + cards for deals where the current account
// is client or freelancer.
export default function Deals() {
  const { state, account } = useJuri();
  const navigate = useNavigate();

  const all = state.deals;
  const active = all.filter((d) => d.status === "Created" || d.status === "Delivered");
  const inDispute = all.filter((d) => d.status === "Disputed");
  const completed = all.filter((d) => d.status === "Approved" || d.status === "Resolved");
  const locked = all
    .filter((d) => d.status === "Created" || d.status === "Delivered" || d.status === "Disputed")
    .reduce((sum, d) => sum + d.amount, 0);

  const mine = all.filter((d) => d.client === account || d.freelancer === account);

  return (
    <div className="max-w-6xl mx-auto px-3 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Deals</h1>
        <Link to="/deals/new" className="min-h-[44px] inline-flex items-center rounded-lg bg-[#8b5cf6] px-4 text-white">
          Create new deal
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active" value={active.length} />
        <StatCard label="In dispute" value={inDispute.length} />
        <StatCard label="Completed" value={completed.length} />
        <StatCard label="Total ETH locked" value={ethFromMicro(locked)} />
      </div>

      <section>
        <h2 className="font-semibold mb-2">Your deals</h2>
        {mine.length === 0 ? (
          <EmptyState text="No deals yet — create one to get started." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((d) => {
              const tag = dealActionTag(d, account, state);
              return (
                <div key={d.id} className="relative">
                  <DealCard deal={d} onOpen={() => navigate(`/deals/${d.id}`)} />
                  {tag.show && (
                    <span className="absolute -top-2 right-3 rounded-full bg-[#8b5cf6]/20 border border-[#8b5cf6] text-[#c4b5fd] text-[11px] px-2 py-0.5">
                      {tag.text}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-[#1c1530] border border-[#3a2f5a] rounded-2xl p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}