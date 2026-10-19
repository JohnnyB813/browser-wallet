import { useEffect, useRef, useState } from "react";
import { toast } from "../utils/toast";

type Row = { label: string; value: string };

export type SpendOutcome = { ok: boolean; title: string; message: string };

/** Review, in-sheet progress, and the completion state for a send, swap, or tunnel. */
export function useSpendFlow() {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("Submitting…");
  const [outcome, setOutcome] = useState<SpendOutcome | null>(null);
  const succeeded = useRef(false);

  const begin = (nextStep: string) => {
    succeeded.current = false;
    setOutcome(null);
    setStep(nextStep);
    setBusy(true);
  };

  const finish = (ok: boolean, title: string, message?: string) => {
    const text = message?.trim() || (ok ? "Done." : "Something went wrong.");
    succeeded.current = ok;
    setBusy(false);
    setOutcome({ ok, title, message: text });
    toast.settled(ok ? "success" : "error", title, text);
  };

  /** Closes the outcome. Runs `onSuccess` only after a successful finish. */
  const close = (onSuccess?: () => void) => {
    if (busy) return false;
    const ok = succeeded.current;
    succeeded.current = false;
    setOutcome(null);
    if (ok) onSuccess?.();
    return ok;
  };

  return { busy, step, setStep, outcome, begin, finish, close };
}

export default function SpendConfirm({
  open,
  title,
  rows,
  confirmLabel = "Confirm and send",
  busyLabel = "Working…",
  step,
  busy,
  outcome,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  rows: Row[];
  confirmLabel?: string;
  busyLabel?: string;
  step?: string;
  busy?: boolean;
  outcome?: SpendOutcome | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const working = Boolean(busy) && !outcome;
  const status = step?.trim() || busyLabel;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!open || !outcome?.ok) return undefined;
    const timer = window.setTimeout(() => cancelRef.current(), 1700);
    return () => window.clearTimeout(timer);
  }, [open, outcome?.ok, outcome?.title, outcome?.message]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-4">
        <h2 className="mb-3 text-base font-semibold text-white">
          {outcome ? outcome.title : title}
        </h2>
        {outcome ? (
          <div className="mb-4 flex items-start gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
                outcome.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"
              }`}
            >
              {outcome.ok ? "✓" : "!"}
            </div>
            <div>
              <p className="text-sm text-white">{outcome.message}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {outcome.ok ? "Closing this in a moment." : "Nothing else was sent."}
              </p>
            </div>
          </div>
        ) : (
          <dl className={`mb-4 space-y-2 ${working ? "opacity-55" : ""}`}>
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{row.label}</dt>
                <dd className="break-all font-mono text-sm text-white">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {working ? (
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-1 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <div>
              <p className="text-sm text-primary">{status}</p>
              <p className="text-xs text-zinc-400">Leave this open until it finishes.</p>
            </div>
          </div>
        ) : null}
        <div className="flex gap-2">
          {outcome ? (
            <button type="button" className="defi-btn-primary flex-1" onClick={onCancel}>
              {outcome.ok ? "Done" : "Close"}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="defi-compact-btn flex-1"
                onClick={onCancel}
                disabled={working}
              >
                Cancel
              </button>
              <button
                type="button"
                className="defi-btn-primary flex-1"
                onClick={onConfirm}
                disabled={working}
              >
                {working ? "Working…" : confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
