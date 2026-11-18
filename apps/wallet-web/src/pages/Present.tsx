import { useState } from "react";
import { useLocation } from "react-router-dom";
import type { SdJwtVcCredential, PresentationRequest, VerifiablePresentation } from "@campus-cred/types";
import { buildPresentation, unlockPrivateKey, loadWallet } from "../lib";

const VERIFIER_API = import.meta.env.VITE_VERIFIER_API_URL ?? "http://localhost:3002";

/**
 * Presentation flow:
 *  1. wallet fetches the request (id + nonce + domain) from the verifier
 *  2. user sees exactly which claims are requested and toggles disclosures
 *  3. wallet builds a key-binding JWT (nonce+domain) and posts the presentation
 */
export default function Present() {
  const location = useLocation();
  const credential = (location.state as { credential?: SdJwtVcCredential })?.credential;
  const [requestId, setRequestId] = useState("");
  const [request, setRequest] = useState<PresentationRequest | null>(null);
  const [pin, setPin] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!credential) return <p className="text-slate-400">Pick a credential first.</p>;

  async function loadRequest() {
    setStatus("Loading request…");
    try {
      const res = await fetch(`${VERIFIER_API}/api/presentations/request/${requestId}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const req = (await res.json()) as PresentationRequest;
      setRequest(req);
      const paths = new Set(
        req.constraints.filter((c) => !c.zk).map((c) => c.path).filter((p) => p !== "enrollmentStatus")
      );
      setSelected(new Set(Array.from(paths).slice(0, 1))); // default minimal selection
      setStatus(null);
    } catch (e) {
      setStatus(`Could not load request: ${(e as Error).message}`);
    }
  }

  async function submit() {
    if (!request || !credential) return;
    setStatus("Signing presentation…");
    try {
      const privateKey = await unlockPrivateKey(pin);
      const w = loadWallet();
      if (!w) throw new Error("wallet not found");

      const vp: VerifiablePresentation = buildPresentation({
        request,
        sdJwt: credential.sdJwt,
        holderDid: w.did,
        holderPrivateKey: privateKey,
        disclose: Array.from(selected),
      });

      setStatus("Submitting to verifier…");
      const res = await fetch(`${VERIFIER_API}/api/presentations/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(vp),
      });
      const outcome = await res.json();
      setResult(outcome.status);
      setStatus(null);
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Present credential</h1>
      <div className="rounded bg-slate-900 p-3 text-sm">
        <div className="font-semibold">{credential.type}</div>
        <div className="text-xs text-slate-400">{credential.credentialHash.slice(0, 24)}…</div>
      </div>

      {!request && (
        <>
          <label className="block space-y-2">
            <span className="text-sm">Presentation request ID (scan the verifier QR)</span>
            <input
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              className="w-full rounded bg-slate-900 px-3 py-2 border border-slate-700 font-mono text-sm"
            />
          </label>
          <button onClick={loadRequest} disabled={!requestId} className="rounded bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-50">
            Load request
          </button>
        </>
      )}

      {request && (
        <div className="space-y-4 rounded-lg border border-amber-800 bg-amber-950/30 p-4">
          <div className="font-semibold text-amber-300">
            {request.verifierDomain} is requesting:
          </div>
          <ul className="text-sm space-y-1">
            {request.constraints.map((c) => (
              <li key={c.path} className="flex items-center justify-between gap-3">
                <span>
                  {c.path} {c.predicate} {c.value !== undefined ? String(c.value) : ""}
                </span>
                {c.zk ? (
                  <span className="text-xs rounded bg-emerald-900 px-2 py-0.5">proven without sharing</span>
                ) : (
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selected.has(c.path)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        e.target.checked ? next.add(c.path) : next.delete(c.path);
                        setSelected(next);
                      }}
                    />
                    share
                  </label>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400">
            Nonce {request.nonce.slice(0, 8)}… bound to this verifier — the presentation cannot be replayed elsewhere.
          </p>
        </div>
      )}

      {request && (
        <div className="space-y-3">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN to unlock key"
            className="w-full rounded bg-slate-900 px-3 py-2 border border-slate-700"
          />
          <button onClick={submit} disabled={!pin} className="w-full rounded bg-emerald-600 py-2 font-semibold disabled:opacity-50">
            Approve & share
          </button>
        </div>
      )}

      {status && <p className="text-sm text-slate-300">{status}</p>}
      {result && (
        <p className={`font-bold ${result === "VERIFIED" ? "text-emerald-400" : "text-red-400"}`}>{result}</p>
      )}
    </div>
  );
}
