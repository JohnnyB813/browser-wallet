export type ToastKind = 'success' | 'error' | 'info' | 'loading';

export type ToastItem = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
};

type Listener = (item: ToastItem | null) => void;

const listeners = new Set<Listener>();
let current: ToastItem | null = null;
let timer = 0;
let nextId = 1;

const SETTLED_MS = { success: 7000, error: 8000 } as const;
const DEFAULT_MS = { success: 2800, error: 4200, info: 3200 } as const;

function emit(item: ToastItem | null): void {
  current = item;
  listeners.forEach((listener) => listener(item));
}

export function showToast(
  kind: ToastKind,
  title: string,
  message?: string,
  duration?: number,
): void {
  window.clearTimeout(timer);
  const item = { id: nextId, kind, title, message };
  nextId += 1;
  emit(item);
  const ms = duration ?? (kind === 'loading' ? 0 : DEFAULT_MS[kind]);
  if (ms > 0) {
    timer = window.setTimeout(() => {
      if (current?.id === item.id) emit(null);
    }, ms);
  }
}

export function updateToast(
  kind: ToastKind,
  title: string,
  message?: string,
  duration?: number,
): void {
  showToast(kind, title, message, duration);
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export const toast = {
  success: (title: string, message?: string) => showToast('success', title, message),
  error: (title: string, message?: string) => showToast('error', title, message),
  info: (title: string, message?: string) => showToast('info', title, message),
  loading: (title: string, message?: string) => showToast('loading', title, message, 0),
  update: updateToast,
  settled: (kind: 'success' | 'error', title: string, message?: string) =>
    showToast(kind, title, message, SETTLED_MS[kind]),
};
