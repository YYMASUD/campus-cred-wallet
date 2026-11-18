import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { CampusCredentialType, PresentationRequest, VerificationOutcome } from "@campus-cred/types";

const API = "/api";

type Preset = {
  label: string;
  purpose: string;
  acceptedTypes: CampusCredentialType[];
  constraints: PresentationRequest["constraints"];
};

const PRESETS: Preset[] = [
  {
    label: "Event gate: valid ticket + enrolled student + age ≥ 18",
    purpose: "Event access control",
    acceptedTypes: ["EventTicketCredential", "StudentIdCredential"],
    constraints: [
      { path: "ticketId", predicate: "eq" },
      { path: "enrollmentStatus", predicate: "eq", value: "enrolled", zk: true },
      { path: "birthDate", predicate: "lte", value: 18, zk: true },
    ],
  },
  {
    label: "Library: enrolled student only",
    purpose: "Library access",
    acceptedTypes: ["StudentIdCredential"],
    constraints: [{ path: "enrollmentStatus", predicate: "eq", value: "enrolled", zk: true }],
  },
  {
    label: "Employer: course certificate",
    purpose: "Credential check",
    acceptedTypes: ["CourseCertificateCredential"],
    constraints: [{ path: "courseName", predicate: "eq" }],
  },
];

export default function VerifierPortal() {
  const [preset, setPreset] = useState(0);
  const [request, setRequest] = useState<PresentationRequest | null>(null);
  const [outcome, setOutcome] = useState<VerificationOutcome | { status: "PENDING" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function createRequest() {
    setError(null);
    setOutcome(null);
    try {
      const p = PRESETS[preset];
      const res = await fetch(`${API}/presentations/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acceptedTypes: p.acceptedTypes, constraints: p.constraints, purpose: p.purpose }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRequest(data.request);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // render QR of the request id (wallet scans/enters it)
  useEffect(() => {
    if (request && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, request.id, { width: 240, margin: 1 }).catch(() => undefined);
    }
  }, [request]);

  // poll for the verification outcome
  useEffect(() => {
    if (!request) return;
    const id = setInterval(async () => {
      const res = await fetch(`${API}/presentations/${request.id}/status`);
      if (res.ok) {
        const data = await res.json();
        setOutcome(data.outcome);
        if (data.outcome?.status !== "PENDING") clearInterval(id);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [request]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Verifier Portal</h1>

      <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <label className="block text-sm">
          Request preset
          <select
            value={preset}
            onChange={(e) => setPreset(Number(e.target.value))}
            className="mt-1 w-full rounded bg-slate-950 px-2 py-1 border border-slate-700"
          >
            {PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button onClick={createRequest} className="rounded bg-indigo-600 px-4 py-2 font-semibold">
          Create presentation request
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      {request && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-white p-4">
            <canvas ref={canvasRef} />
            <div className="mt-2 font-mono text-[10px] text-slate-700 break-all">{request.id}</div>
          </div>
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
            <div className="font-semibold">Requested</div>
            <ul className="space-y-1 text-xs">
              {request.constraints.map((c) => (
                <li key={c.path}>
                  {c.path} {c.predicate} {c.value !== undefined ? String(c.value) : ""}{" "}
                  {c.zk && <span className="text-emerald-400">(zero-knowledge)</span>}
                </li>
              ))}
            </ul>
            <div className="pt-2 text-xs text-slate-400">
              Domain: {request.verifierDomain}
              <br />
              Nonce: {request.nonce.slice(0, 12)}…
            </div>
          </div>
        </section>
      )}

      {outcome && (
        <div
          className={`rounded-lg p-4 text-center text-xl font-bold ${
            outcome.status === "VERIFIED"
              ? "bg-emerald-900 text-emerald-200"
              : outcome.status === "PENDING"
                ? "bg-slate-800 text-slate-300"
                : "bg-red-900 text-red-200"
          }`}
        >
          {outcome.status}
          {outcome.status === "VERIFIED" && (
            <div className="mt-2 text-xs font-normal">
              disclosed: {outcome.disclosedClaims.map((c) => c.path).join(", ") || "nothing beyond proofs"}
            </div>
          )}
          {outcome.status === "INVALID" && <div className="mt-2 text-xs font-normal">{outcome.reason}</div>}
          {outcome.status === "REVOKED" && <div className="mt-2 text-xs font-normal">{outcome.reason}</div>}
        </div>
      )}
    </div>
  );
}
