import { useState } from "react";
import { useJuri, pushToast } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { ethFromMicro, ethToMicro, juri } from "../lib/format.js";

// BuyJuriModal — dummy JURI token purchase (SPEC C1.2). Owned by Dev1.
export default function BuyJuriModal({ open, onClose }) {
  const { state, account, act } = useJuri();
  const [ethInput, setEthInput] = useState("0.1");
  if (!open) return null;
  const acct = state.accounts[account];
  const ethMicro = Number(ethInput) > 0 ? ethToMicro(Number(ethInput)) : 0;
  const preview = Math.floor((ethMicro / 1000000) * 10000);

  const buy = () => {
    const res = act((s) => JuriDAO.buyTokens(s, account, ethMicro));
    if (res !== undefined) {
      pushToast(`Bought ${juri(res)} JURI for ${(ethMicro / 1000000).toFixed(4)} ETH`, "success");
      onClose();
    }
  };
  const faucet = () => {
    const res = act((s) => JuriDAO.faucet(s, account));
    if (res !== undefined) pushToast("Faucet: received 5,000 JURI", "success");
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[#1c1530] rounded-t-2xl sm:rounded-2xl border border-[#3a2f5a] w-full sm:max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-1">Buy JURI</h2>
        <p className="text-xs text-gray-400 mb-4">JURI is the dummy jury token. 1 ETH = 10,000 JURI.</p>
        <label className="block text-sm text-gray-300 mb-1">Amount in ETH</label>
        <input
          className="w-full min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3"
          type="number"
          min="0"
          step="0.01"
          value={ethInput}
          onChange={(e) => setEthInput(e.target.value)}
        />
        <p className="text-sm mt-2">You will get <span className="text-[#8b5cf6] font-semibold">{juri(preview)} JURI</span></p>
        <p className="text-xs text-gray-400 mt-1">Your ETH balance: {ethFromMicro(acct.eth)} · Your JURI: {juri(acct.juri)}</p>
        <div className="flex gap-2 mt-4">
          <button className="flex-1 min-h-[44px] rounded-lg bg-[#8b5cf6] text-white font-medium" onClick={buy}>Buy</button>
          <button className="flex-1 min-h-[44px] rounded-lg border border-[#38bdf8] text-[#38bdf8]" onClick={faucet}>Faucet (+5,000)</button>
        </div>
        <button className="mt-3 w-full min-h-[44px] text-sm text-gray-400" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
