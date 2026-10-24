import { useEffect, useRef, useState } from "react";
import { toast } from "../utils/toast";
import TokenMark from "./chains/TokenMark";

type Row = { label: string; value: string; /** Optional token symbol shown as an icon beside the value. */ icon?: string };

export type SpendOutcome = {
  ok: boolean;
  title: string;
  message: string;
  /** The send succeeded and a later step is still running. The sheet stays open. */
  pending?: boolean;
};

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

  /** Source transaction is in. Keep the spinner on the current bridge step until the user closes it. */
  const hold = (title: string, message: string) => {
    succeeded.current = true;
    setBusy(false);
    setStep(title);
    setOutcome({ ok: true, pending: true, title, message });
  };

  /** Refresh a held step. No effect once the sheet has moved on. */
  const note = (title: string, message: string) => {
    setStep(title);
    setOutcome((current) => {
      if (!current?.pending) return current;
      if (current.title === title && current.message === message) return current;
      return { ok: true, pending: true, title, message };
    });
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

  return { busy, step, setStep, outcome, begin, finish, hold, note, close };
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
    if (!open || !outcome?.ok || outcome.pending) return undefined;
    const timer = window.setTimeout(() => cancelRef.current(), 1700);
    return () => window.clearTimeout(timer);
  }, [open, outcome?.ok, outcome?.pending, outcome?.title, outcome?.message]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-4">
        <h2 className="mb-3 text-base font-semibold text-white">
          {outcome ? outcome.title : title}
        </h2>
        {outcome ? (
          <div className="mb-4 flex items-start gap-3">
            {outcome.pending ? (
              <div className="mt-1 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
                  outcome.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"
                }`}
              >
                {outcome.ok ? "✓" : "!"}
              </div>
            )}
            <div>
              <p className="text-sm text-white">{outcome.message}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {outcome.pending
                  ? "The tracker on this screen keeps this step. Close this whenever you want."
                  : outcome.ok ? "Closing this in a moment." : "Nothing else was sent."}
              </p>
            </div>
          </div>
        ) : (
          <dl className={`mb-4 space-y-2 ${working ? "opacity-55" : ""}`}>
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{row.label}</dt>
                <dd className="flex items-center gap-2 break-all font-mono text-sm text-white">
                  {row.icon ? <TokenMark symbol={row.icon} size={20} /> : null}
                  <span>{row.value}</span>
                </dd>
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
              {outcome.pending || !outcome.ok ? "Close" : "Done"}
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
