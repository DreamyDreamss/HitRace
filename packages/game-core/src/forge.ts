// High-level orchestration: validated run → full sword. The server calls this
// after validateRun() passes. Naming suggestions come from the course.

import { computeCP, computeForgeScore, deriveMetrics, deriveShape, deriveStats, fingerprint } from './conversion.js';
import type { RunMetrics, RunTrack, Sword } from './types.js';

export interface ForgeContext {
  ownerId: string;
  runId: string;
  swordId: string;
  /** How many times this runner already forged this course (0 = first). */
  repeatIndex: number;
  createdAt: number;
  /** Suggested name (e.g. from reverse-geocoded course). */
  name?: string;
  /** Number of engraving slots to open (rarity-driven; caller decides). */
  engravingSlots?: number;
}

export interface ForgeOutcome {
  sword: Sword;
  metrics: RunMetrics;
}

export function forgeSword(track: RunTrack, ctx: ForgeContext): ForgeOutcome {
  const metrics = deriveMetrics(track);
  const isNewCourse = ctx.repeatIndex === 0;
  const score = computeForgeScore(metrics, { repeatIndex: ctx.repeatIndex, isNewCourse });
  const stats = deriveStats(metrics);
  const shape = deriveShape(track, metrics);
  const cp = computeCP(stats);
  const slots = ctx.engravingSlots ?? defaultSlots(score.rarity);

  const sword: Sword = {
    id: ctx.swordId,
    ownerId: ctx.ownerId,
    name: ctx.name ?? suggestName(shape.style, score.rarity),
    rarity: score.rarity,
    stats,
    shape,
    plus: 0,
    cp,
    engravings: Array.from({ length: slots }, () => null),
    runId: ctx.runId,
    courseHash: fingerprint(track),
    createdAt: ctx.createdAt,
  };

  return { sword, metrics };
}

function defaultSlots(rarity: string): number {
  switch (rarity) {
    case 'LEGEND':
      return 3;
    case 'SR':
      return 2;
    case 'R':
      return 1;
    default:
      return 0;
  }
}

const STYLE_NAMES: Record<string, string[]> = {
  straight: ['직도', '장검', '한강 새벽선'],
  curved: ['곡도', '월아', '남산 곡도'],
  double_edge: ['양날검', '쌍월', '왕복선'],
  chakram: ['환도', '차크람', '순환환'],
};

function suggestName(style: string, rarity: string): string {
  const pool = STYLE_NAMES[style] ?? ['무명검'];
  const idx = rarity === 'LEGEND' ? 2 : rarity === 'SR' ? 1 : 0;
  return pool[Math.min(idx, pool.length - 1)]!;
}
