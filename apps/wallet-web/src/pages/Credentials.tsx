import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadCredentials, type StoredCredential } from "../lib/wallet";

export default function Credentials() {
  const [creds, setCreds] = useState<StoredCredential[]>([]);

  useEffect(() => {
    setCreds(loadCredentials());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My credentials</h1>
        <Link to="/claim" className="text-sm text-indigo-400 underline">
          + Receive credential
        </Link>
      </div>

      {creds.length === 0 ? (
        <p className="text-slate-400">No credentials yet. Scan an issuer QR to receive one.</p>
      ) : (
        <ul className="space-y-4">
          {creds.map((c) => (
            <li key={c.credential.credentialHash} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{c.credential.type}</div>
                  <div className="text-xs text-slate-400">issued by {c.credential.issuerDid}</div>
                  <div className="text-xs text-slate-500">received {new Date(c.addedAt).toLocaleString()}</div>
                </div>
                <span className="rounded bg-emerald-900 px-2 py-1 text-xs">valid</span>
              </div>
              <Link
                to="/present"
                state={{ credential: c.credential }}
                className="mt-3 inline-block text-sm text-indigo-400 underline"
              >
                Present →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
