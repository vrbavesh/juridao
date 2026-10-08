import { useState } from "react";
import { useJuri, pushToast } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { ethFromMicro, ethToMicro, juri } from "../lib/format.js";
import BuyJuriModal from "../components/BuyJuriModal.jsx";

// SPEC 8.7 + C1: token panel, token card, court table, join/unstake modals.
export default function Courts() {
  const { state, account, act } = useJuri();
  const [ethInput, setEthInput] = useState("0.1");
  const [stakeModal, setStakeModal] = useState(null); // court object
  const [stakeAmount, setStakeAmount] = useState("1000");
  const [unstakeModal, setUnstakeModal] = useState(null); // court object
  const [unstakeAmount, setUnstakeAmount] = useState("500");
  const [buyOpen, setBuyOpen] = useState(false);
  const [openPolicy, setOpenPolicy] = useState({});

  const acct = state.accounts[account];
  const ethMicro = Number(ethInput) > 0 ? ethToMicro(Number(ethInput)) : 0;
  const preview = Math.floor((ethMicro / 1000000) * 10000);

  const buy = () => {
    const res = act((s) => JuriDAO.buyTokens(s, account, ethMicro));
    if (res !== undefined) pushToast(`Bought ${juri(res)} JURI for ${(ethMicro / 1000000).toFixed(4)} ETH`, "success");
  };
  const faucet = () => {
    const res = act((s) => JuriDAO.faucet(s, account));
    if (res !== undefined) pushToast("Faucet: received 5,000 JURI", "success");
  };
  const join = () => {
    const amount = Math.round(Number(stakeAmount));
    const res = act((s) => JuriDAO.stakeJuri(s, account, stakeModal.id, amount));
    if (res !== undefined) {
      pushToast(`Staked ${juri(amount)} JURI in ${stakeModal.name}`, "success");
      setStakeModal(null);
    }
  };
  const unstake = () => {
    const amount = Math.round(Number(unstakeAmount));
    const res = act((s) => JuriDAO.unstakeJuri(s, account, unstakeModal.id, amount));
    if (res !== undefined) {
      pushToast(`Unstaked ${juri(amount)} JURI from ${unstakeModal.name}`, "success");
      setUnstakeModal(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Courts and the JURI token</h1>

      {/* Token card (C1.1) */}
      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">JURI, the jury token (dummy)</h2>
        <ul className="list-disc pl-5 text-sm text-gray-300 space-y-1">
          <li>You need JURI to join a court as a juror</li>
          <li>When you are drawn, part of your stake is locked for that case</li>
          <li>Vote with the majority: you earn ETH fees and JURI</li>
          <li>Vote against the majority or skip: you lose the locked JURI</li>
        </ul>
      </section>

      {/* Token panel (8.7) */}
      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-3">Token balances</h2>
        <p className="text-sm text-gray-300 mb-3">
          ETH: <b>{ethFromMicro(acct.eth)}</b> · JURI: <b>{juri(acct.juri)}</b>
        </p>
        <p className="text-sm text-gray-400 mb-2">1 ETH = 10,000 JURI (dummy)</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            className="min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3 w-full sm:w-40"
            type="number" min="0" step="0.01" value={ethInput}
            onChange={(e) => setEthInput(e.target.value)}
          />
          <span className="text-sm text-gray-400">ETH → {juri(preview)} JURI</span>
        </div>
        <div className="flex gap-2 mt-3">
          <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-4 text-white" onClick={buy}>Buy JURI</button>
          <button className="min-h-[44px] rounded-lg border border-[#38bdf8] text-[#38bdf8] px-4" onClick={faucet}>Free faucet (+5,000)</button>
        </div>
      </section>

      {/* Court table */}
      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 overflow-x-auto">
        <h2 className="font-semibold mb-3">Courts</h2>
        <table className="w-full text-sm hidden sm:table">
          <thead>
            <tr className="text-left text-gray-400">
              <th className="pb-2 pr-4">Court</th><th className="pb-2 pr-4">Min stake</th><th className="pb-2 pr-4">Fee / juror</th>
              <th className="pb-2 pr-4">Cases</th><th className="pb-2 pr-4">Total staked</th><th className="pb-2 pr-4">Your stake</th>
              <th className="pb-2 pr-4">Your draw chance</th><th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.courts.map((c) => {
              const myStake = (state.stake[c.id] && state.stake[c.id][account]) || 0;
              const chance = c.totalStaked > 0 ? Math.round((myStake / c.totalStaked) * 100) : 0;
              return (
                <CourtRowFragment key={c.id} court={c} stake={myStake} chance={chance}
                  open={!!openPolicy[c.id]}
                  onTogglePolicy={() => setOpenPolicy({ ...openPolicy, [c.id]: !openPolicy[c.id] })}
                  onJoin={() => { setStakeAmount(String(c.minStake)); setStakeModal(c); }}
                  onUnstake={() => { setUnstakeAmount("500"); setUnstakeModal(c); }} />
              );
            })}
          </tbody>
        </table>
        {/* Stacked cards below 640px */}
        <div className="sm:hidden space-y-4">
          {state.courts.map((c) => {
            const myStake = (state.stake[c.id] && state.stake[c.id][account]) || 0;
            const chance = c.totalStaked > 0 ? Math.round((myStake / c.totalStaked) * 100) : 0;
            return (
              <div key={c.id} className="border border-[#3a2f5a] rounded-xl p-4 text-sm space-y-1">
                <div className="font-semibold">{c.name}</div>
                <div>Min stake: {juri(c.minStake)} · Fee/juror: {ethFromMicro(c.feePerJuror)}</div>
                <div>Cases: {c.cases} · Total staked: {juri(c.totalStaked)}</div>
                <div>Your stake: {juri(myStake)} · Draw chance: {chance}%</div>
                <p className="text-gray-400">{c.policy}</p>
                <div className="flex gap-2 pt-1">
                  <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-3 text-white text-sm" onClick={() => { setStakeAmount(String(c.minStake)); setStakeModal(c); }}>Join / add stake</button>
                  <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-3 text-sm" onClick={() => { setUnstakeAmount("500"); setUnstakeModal(c); }}>Unstake</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stake modal */}
      {stakeModal && (
        <Modal onClose={() => setStakeModal(null)} title={`Join ${stakeModal.name}`}>
          <p className="text-sm text-gray-400 mb-2">Minimum stake: {juri(stakeModal.minStake)} JURI · Your balance: {juri(acct.juri)} JURI</p>
          <input className="min-h-[44px] w-full rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3" type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} />
          <button className="mt-3 min-h-[44px] w-full rounded-lg bg-[#8b5cf6] text-white" onClick={join}>Stake JURI</button>
        </Modal>
      )}
      {unstakeModal && (
        <Modal onClose={() => setUnstakeModal(null)} title={`Unstake from ${unstakeModal.name}`}>
          <p className="text-sm text-gray-400 mb-2">Your stake: {juri((state.stake[unstakeModal.id] && state.stake[unstakeModal.id][account]) || 0)} JURI</p>
          <input className="min-h-[44px] w-full rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3" type="number" value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} />
          <button className="mt-3 min-h-[44px] w-full rounded-lg bg-[#8b5cf6] text-white" onClick={unstake}>Unstake</button>
        </Modal>
      )}
      <BuyJuriModal open={buyOpen} onClose={() => setBuyOpen(false)} />
    </div>
  );
}

function CourtRowFragment({ court, stake, chance, open, onTogglePolicy, onJoin, onUnstake }) {
  return (
    <>
      <tr className="border-t border-[#3a2f5a]">
        <td className="py-3 pr-4">{court.name}</td>
        <td className="py-3 pr-4">{juri(court.minStake)}</td>
        <td className="py-3 pr-4">{ethFromMicro(court.feePerJuror)}</td>
        <td className="py-3 pr-4">{court.cases}</td>
        <td className="py-3 pr-4">{juri(court.totalStaked)}</td>
        <td className="py-3 pr-4">{juri(stake)}</td>
        <td className="py-3 pr-4">{chance}%</td>
        <td className="py-3 space-x-2 whitespace-nowrap">
          <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-3 text-white text-sm" onClick={onJoin}>Join / add stake</button>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-3 text-sm" onClick={onUnstake}>Unstake</button>
          <button className="min-h-[44px] px-3 text-sm text-[#38bdf8]" onClick={onTogglePolicy}>{open ? "Hide" : "Policy"}</button>
        </td>
      </tr>
      {open && <tr><td colSpan={8} className="py-3 text-sm text-gray-400">{court.policy}</td></tr>}
    </>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[#1c1530] rounded-t-2xl sm:rounded-2xl border border-[#3a2f5a] w-full sm:max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">{title}</h3>
        {children}
        <button className="mt-3 w-full min-h-[44px] text-sm text-gray-400" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
