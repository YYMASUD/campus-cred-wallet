import { useEffect, useState } from "react";
import type { CampusCredentialType } from "@campus-cred/types";
import { createDidKey } from "@campus-cred/sdk";

const API = "/api";

const TEMPLATES: Record<CampusCredentialType, string[]> = {
  StudentIdCredential: ["givenName", "familyName", "studentNumber", "program", "enrollmentStatus", "birthDate", "university"],
  CourseCertificateCredential: ["courseName", "grade", "credits", "completedAt"],
  EventTicketCredential: ["eventName", "eventId", "ticketId", "seat"],
  MembershipCredential: ["clubName", "memberSince", "status"],
};

export default function IssuerPortal() {
  const [holderDid, setHolderDid] = useState("");
  const [type, setType] = useState<CampusCredentialType>("StudentIdCredential");
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [offer, setOffer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Array<{ hash: string; type: string }>>([]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of TEMPLATES[type]) next[f] = claims[f] ?? "";
    setClaims(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  function generateHolder() {
    setHolderDid(createDidKey().did);
  }

  async function issue() {
    setError(null);
    setOffer(null);
    try {
      const res = await fetch(`${API}/credentials/issue`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ holderDid, type, claims }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const offerId = data.credentialOfferUri.split("offer=")[1];
      setOffer(offerId);
      setIssued((p) => [{ hash: data.credential.credentialHash, type }, ...p]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function revoke(hash: string) {
    await fetch(`${API}/credentials/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credentialHash: hash }),
    });
    setIssued((p) => p.filter((i) => i.hash !== hash));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Issuer Portal</h1>

      <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold">Issue a credential</h2>

        <label className="block text-sm">
          Holder DID
          <div className="flex gap-2">
            <input
              value={holderDid}
              onChange={(e) => setHolderDid(e.target.value)}
              className="flex-1 rounded bg-slate-950 px-2 py-1 border border-slate-700 font-mono text-xs"
              placeholder="did:key:z6Mk…"
            />
            <button onClick={generateHolder} className="rounded bg-slate-700 px-3 text-xs">
              generate demo DID
            </button>
          </div>
        </label>

        <label className="block text-sm">
          Credential type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CampusCredentialType)}
            className="mt-1 w-full rounded bg-slate-950 px-2 py-1 border border-slate-700"
          >
            {Object.keys(TEMPLATES).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>

        {Object.keys(claims).map((f) => (
          <label key={f} className="block text-sm">
            {f}
            <input
              value={claims[f]}
              onChange={(e) => setClaims({ ...claims, [f]: e.target.value })}
              className="mt-1 w-full rounded bg-slate-950 px-2 py-1 border border-slate-700 text-sm"
            />
          </label>
        ))}

        <button onClick={issue} disabled={!holderDid} className="rounded bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-50">
          Issue credential
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {offer && (
          <div className="rounded bg-emerald-950 p-3 text-sm">
            <div className="font-semibold text-emerald-300">Credential offer ready</div>
            <div className="mt-1 font-mono text-xs break-all">{offer}</div>
            <div className="mt-1 text-xs text-slate-400">
              Open the wallet → Receive credential → paste this offer id.
            </div>
          </div>
        )}
      </section>

      {issued.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Issued in this session</h2>
          {issued.map((i) => (
            <div key={i.hash} className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-3 text-sm">
              <div>
                <div>{i.type}</div>
                <div className="font-mono text-xs text-slate-400">{i.hash.slice(0, 24)}…</div>
              </div>
              <button onClick={() => revoke(i.hash)} className="rounded bg-red-700 px-3 py-1 text-xs">
                Revoke
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
