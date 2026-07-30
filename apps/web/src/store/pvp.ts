import { create } from 'zustand';
import type { ResolveResponse } from '../lib/api';

interface PvpStore {
  result?: ResolveResponse;
  myName?: string;
  setResult: (r: ResolveResponse, myName: string) => void;
  clear: () => void;
}

// Carries the resolved combat (deterministic log) from matching → battle screen.
export const usePvp = create<PvpStore>((set) => ({
  setResult: (result, myName) => set({ result, myName }),
  clear: () => set({ result: undefined, myName: undefined }),
}));
