import type { SdJwtVcCredential } from "@campus-cred/types";

export function CredentialCard({ credential }: { credential: SdJwtVcCredential }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{credential.type}</div>
          <div className="text-xs text-slate-400">issued by {credential.issuerDid}</div>
        </div>
        <span className="rounded bg-emerald-900 px-2 py-1 text-xs">valid</span>
      </div>
      <div className="mt-2 font-mono text-[10px] text-slate-500">
        {credential.credentialHash.slice(0, 18)}…
      </div>
    </div>
  );
}
