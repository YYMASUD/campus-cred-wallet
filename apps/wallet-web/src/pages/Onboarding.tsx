import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createWallet } from "../lib/wallet";

export default function Onboarding() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  async function onCreate() {
    if (pin.length < 4) return setError("PIN must be at least 4 characters");
    setBusy(true);
    try {
      await createWallet(pin);
      nav("/credentials");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Create your wallet</h1>
      <p className="text-slate-300">
        A decentralized identifier (DID) and Ed25519 keypair will be generated on this device. Your private key
        is encrypted with your PIN and never leaves this browser.
      </p>

      <label className="block space-y-2">
        <span className="text-sm">Set a PIN (min 4 characters)</span>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded bg-slate-900 px-3 py-2 border border-slate-700"
          placeholder="••••"
        />
      </label>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={onCreate}
        disabled={busy}
        className="w-full rounded bg-indigo-600 py-2 font-semibold disabled:opacity-50"
      >
        {busy ? "Generating keys…" : "Create wallet"}
      </button>
    </div>
  );
}
