import { useEffect, useState } from 'react';
import { subscribeToast, type ToastItem } from '../utils/toast';

const MARK: Record<ToastItem['kind'], string> = {
  success: '✓',
  error: '!',
  info: 'i',
  loading: '…',
};

export default function AppToast() {
  const [item, setItem] = useState<ToastItem | null>(null);

  useEffect(() => subscribeToast(setItem), []);

  if (!item) return null;
  const tone = item.kind === 'error'
    ? 'border-red-400/50 text-red-200'
    : item.kind === 'success'
      ? 'border-emerald-400/50 text-emerald-200'
      : 'border-primary/60 text-primary';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex justify-center px-3">
      <div className={`pointer-events-auto w-full max-w-sm rounded-xl border bg-black/90 px-3 py-2 shadow-lg ${tone}`}>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-sm font-semibold">{MARK[item.kind]}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{item.title}</p>
            {item.message ? <p className="text-xs text-white/70 wrap-break-word">{item.message}</p> : null}
          </div>
        </div>
        {item.kind === 'loading' ? (
          <div className="mt-2 h-1 overflow-hidden rounded bg-white/10">
            <div className="h-full w-1/3 animate-pulse rounded bg-primary" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
