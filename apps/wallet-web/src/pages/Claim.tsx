import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { SdJwtVcCredential } from "@campus-cred/types";
import { storeCredential, loadWallet } from "../lib/wallet";

const ISSUER_API = import.meta.env.VITE_ISSUER_API_URL ?? "http://localhost:3001";

/**
 * Credential offer claim flow (OpenID4VCI-like).
 * Accepts ?offer=<offerId> or a pasted offer id, fetches the credential from
 * the issuer, validates it locally and stores it.
 */
export default function Claim() {
  const [params] = useSearchParams();
  const [offerId, setOfferId] = useState(params.get("offer") ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<SdJwtVcCredential | null>(null);

  async function fetchOffer() {
    setStatus("Fetching…");
    try {
      const res = await fetch(`${ISSUER_API}/api/offer/${offerId}`);
      if (!res.ok) throw new Error(await res.text());
      const { credential } = (await res.json()) as { credential: SdJwtVcCredential };
      setPreview(credential);
      setStatus(null);
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  async function accept() {
    if (!preview) return;
    const w = loadWallet();
    // claims are bound to this holder DID by the issuer
    if (preview.holderDid !== w?.did) {
      setStatus("This credential was issued to a different holder.");
      return;
    }
    await fetch(`${ISSUER_API}/api/offer/${offerId}/claim`, { method: "POST" });
    storeCredential(preview, preview.type);
    setStatus("Credential stored ✓");
    setTimeout(() => location.assign("/credentials"), 800);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Receive a credential</h1>

      <label className="block space-y-2">
        <span className="text-sm">Credential offer ID (or scan the issuer QR)</span>
        <input
          value={offerId}
          onChange={(e) => setOfferId(e.target.value)}
          className="w-full rounded bg-slate-900 px-3 py-2 border border-slate-700 font-mono text-sm"
          placeholder="offer_..."
        />
      </label>

      <button onClick={fetchOffer} disabled={!offerId} className="rounded bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-50">
        Fetch credential
      </button>

      {preview && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-2">
          <div className="font-semibold">{preview.type}</div>
          <div className="text-xs text-slate-400">from {preview.issuerDid}</div>
          <div className="text-xs text-slate-500">hash {preview.credentialHash.slice(0, 18)}…</div>
          <button onClick={accept} className="mt-2 rounded bg-emerald-600 px-4 py-2 font-semibold">
            Accept & store
          </button>
        </div>
      )}

      {status && <p className="text-sm text-slate-300">{status}</p>}
    </div>
  );
}
