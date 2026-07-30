import type { Rarity } from '@hitrace/game-core';

export const RARITY_COLOR: Record<Rarity, string> = {
  N: '#5E656F',
  R: '#8FA6C4',
  SR: '#B48CF0',
  LEGEND: '#D9A227',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  N: 'N', R: 'R', SR: 'SR', LEGEND: 'LEGEND',
};

export const STAT_META = [
  { key: 'sharpness', ko: '예리함', color: '#D9A227' },
  { key: 'weight', ko: '중량', color: '#8FA6C4' },
  { key: 'durability', ko: '내구', color: '#C6CBD3' },
  { key: 'magic', ko: '마력', color: '#B48CF0' },
] as const;

export const CURRENCY_META = {
  ore: { ko: '철광석', color: '#8FA6C4' },
  engraveStone: { ko: '각인석', color: '#B48CF0' },
  forgeTicket: { ko: '주조 티켓', color: '#D9A227' },
} as const;

export function paceLabel(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "—'—\"";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${s.toString().padStart(2, '0')}"`;
}
