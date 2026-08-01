// Auto-battle simulator. Deterministic given a seed → the same fight can be
// replayed identically on client (for the spectator animation) and server (for
// the authoritative result). Produces a full event log for the UI to stage.

import { elementAdvantage } from './element.js';
import { BALANCE } from './config/balance.js';
import { Rng } from './rng.js';
import type { Combatant, CombatEventLog, CombatResult } from './types.js';

interface Fighter {
  side: 'a' | 'b';
  ref: Combatant;
  hp: number;
  gauge: number;
  critRate: number;
}

export function simulateCombat(a: Combatant, b: Combatant, seed: number | string): CombatResult {
  const rng = new Rng(seed);
  const cfg = BALANCE.combat;

  const fa: Fighter = { side: 'a', ref: a, hp: cfg.hp, gauge: 0, critRate: critRateOf(a) };
  const fb: Fighter = { side: 'b', ref: b, hp: cfg.hp, gauge: 0, critRate: critRateOf(b) };

  // First move = higher cadence.
  const [first, second] = a.cadence >= b.cadence ? [fa, fb] : [fb, fa];
  const log: CombatEventLog[] = [];

  for (let round = 1; round <= cfg.rounds; round++) {
    for (const attacker of [first, second]) {
      const defender = attacker === fa ? fb : fa;
      if (fa.hp <= 0 || fb.hp <= 0) break;
      takeTurn(attacker, defender, round, rng, log, fa, fb);
    }
    if (fa.hp <= 0 || fb.hp <= 0) break;
  }

  const winner: 'a' | 'b' = fa.hp === fb.hp ? (a.cadence >= b.cadence ? 'a' : 'b') : fa.hp > fb.hp ? 'a' : 'b';
  return { winner, rounds: Math.min(cfg.rounds, log.length ? log[log.length - 1]!.round : 0), log, finalHp: { a: Math.max(0, fa.hp), b: Math.max(0, fb.hp) } };
}

function takeTurn(
  attacker: Fighter,
  defender: Fighter,
  round: number,
  rng: Rng,
  log: CombatEventLog[],
  fa: Fighter,
  fb: Fighter,
): void {
  const cfg = BALANCE.combat;

  // Charge magic gauge; cast skill when full.
  attacker.gauge += attacker.ref.stats.magic / cfg.gaugeChargeDivisor;
  const casting = attacker.gauge >= cfg.skillGaugeMax;
  if (casting) attacker.gauge -= cfg.skillGaugeMax;

  const isCrit = rng.chance(attacker.critRate);
  let dmg = turnDamage(attacker, defender, isCrit);
  let kind: CombatEventLog['kind'] = isCrit ? 'crit' : 'attack';
  let label = swordName(attacker) + (isCrit ? ' · 치명' : ' · 참격');

  if (casting) {
    dmg = Math.round(dmg * cfg.skillDamageMultiplier);
    kind = 'skill';
    label = swordName(attacker) + ' · 필살기';
  }

  // 속성 상성 — the weather each blade was forged in, meeting the other's.
  const counter = elementAdvantage(attacker.ref.element ?? 'none', defender.ref.element ?? 'none');
  if (counter !== 1) {
    dmg = Math.round(dmg * counter);
    if (counter > 1) label += ' · 상성';
  }

  // Engraving triggers (simple additive/percentage hooks).
  const eng = applyEngravings(attacker, dmg);
  dmg = eng.dmg;
  if (eng.note) {
    log.push(mkEvent(round, attacker.side, 'engraving', 0, eng.note, fa, fb));
  }

  defender.hp -= dmg;
  log.push(mkEvent(round, attacker.side, kind, dmg, label, fa, fb));
}

function turnDamage(attacker: Fighter, defender: Fighter, isCrit: boolean): number {
  const cfg = BALANCE.combat;
  const s = attacker.ref.stats;
  const critMult = isCrit ? 1 + attacker.critRate * (s.weight / cfg.critWeightDivisor) : 1;
  const mitigation = 1 - defender.ref.stats.durability / (defender.ref.stats.durability + cfg.durabilityMitigationK);
  return Math.max(1, Math.round(s.sharpness * critMult * mitigation));
}

function critRateOf(c: Combatant): number {
  // Higher weight → higher crit chance, capped. Base 8%.
  return Math.min(0.6, 0.08 + c.stats.weight / 4000);
}

function applyEngravings(attacker: Fighter, dmg: number): { dmg: number; note?: string } {
  for (const e of attacker.ref.engravings) {
    if (!e || !e.trigger) continue;
    if (e.trigger === 'magic_boost') {
      return { dmg: Math.round(dmg * 1.12), note: `${e.name} 발동 · 마력 +12%` };
    }
    if (e.trigger === 'pierce') {
      return { dmg: Math.round(dmg * 1.15), note: `${e.name} 발동 · 관통` };
    }
  }
  return { dmg };
}

function swordName(f: Fighter): string {
  return f.ref.name;
}

function mkEvent(
  round: number,
  actor: 'a' | 'b',
  kind: CombatEventLog['kind'],
  damage: number,
  label: string,
  fa: Fighter,
  fb: Fighter,
): CombatEventLog {
  return { round, actor, kind, damage, label, aHp: Math.max(0, fa.hp), bHp: Math.max(0, fb.hp) };
}
