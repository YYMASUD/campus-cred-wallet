const COLORS: Record<string, string> = {
  VERIFIED: "bg-emerald-900 text-emerald-200",
  INVALID: "bg-red-900 text-red-200",
  REVOKED: "bg-red-900 text-red-200",
  EXPIRED: "bg-amber-900 text-amber-200",
  PENDING: "bg-slate-800 text-slate-300",
};

export function VerificationBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-3 py-1 text-sm font-bold ${COLORS[status] ?? "bg-slate-800"}`}>
      {status}
    </span>
  );
}
