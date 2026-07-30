import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';
export interface Toast { id: number; kind: ToastKind; msg: string }

interface ToastStore {
  toasts: Toast[];
  push: (kind: ToastKind, msg: string) => void;
  remove: (id: number) => void;
}

let seq = 0;
export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, msg) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, msg }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Non-hook accessor for use outside React (e.g. the API layer). */
export const toast = {
  info: (m: string) => useToast.getState().push('info', m),
  success: (m: string) => useToast.getState().push('success', m),
  error: (m: string) => useToast.getState().push('error', m),
};
