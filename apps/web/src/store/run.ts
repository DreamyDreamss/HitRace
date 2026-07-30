import { create } from 'zustand';
import type { GpsPoint, Sword } from '@hitrace/game-core';
import type { ForgeResult } from '../lib/api';

// Carries the finished run track between run → summary → forge-result screens.
interface RunStore {
  track?: { points: GpsPoint[]; cadence?: number[]; heartRate?: number[]; maxHeartRate?: number };
  lastForge?: ForgeResult;
  forgedSword?: Sword;
  setTrack: (t: RunStore['track']) => void;
  setForge: (f: ForgeResult) => void;
  clear: () => void;
}

export const useRun = create<RunStore>((set) => ({
  setTrack: (track) => set({ track }),
  setForge: (lastForge) => set({ lastForge, forgedSword: lastForge.sword }),
  clear: () => set({ track: undefined, lastForge: undefined, forgedSword: undefined }),
}));
