import { Routes, Route, Navigate, Link } from "react-router-dom";
import { loadWallet } from "./lib/wallet";
import Onboarding from "./pages/Onboarding";
import Credentials from "./pages/Credentials";
import Claim from "./pages/Claim";
import Present from "./pages/Present";

export default function App() {
  const wallet = loadWallet();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg">
          campus-cred-wallet
        </Link>
        {wallet && <span className="text-xs text-slate-400 font-mono">{wallet.did.slice(0, 30)}…</span>}
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Routes>
          <Route path="/" element={wallet ? <Navigate to="/credentials" /> : <Navigate to="/onboard" />} />
          <Route path="/onboard" element={<Onboarding />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/claim" element={<Claim />} />
          <Route path="/present" element={<Present />} />
        </Routes>
      </main>
    </div>
  );
}
