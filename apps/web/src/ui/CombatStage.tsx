import { useEffect, useMemo, useRef, useState } from 'react';
import { BALANCE } from '@hitrace/game-core';
import { Button, Card } from './kit';

const HP = BALANCE.combat.hp;

// Structural combat shape accepted from both the engine (union `kind`) and the
// API client (string `kind`).
export interface PlayableCombat {
  winner: 'a' | 'b';
  rounds: number;
  log: Array<{ round: number; actor: 'a' | 'b'; kind: string; damage: number; label: string; aHp: number; bHp: number }>;
}

// Plays a deterministic combat log as a spectator animation. Shared by the live
// PvP battle and shareable replays.
export function CombatStage({
  combat, aName, bName, onDone,
}: {
  combat: PlayableCombat; aName: string; bName: string; onDone?: () => void;
}) {
  const [step, setStep] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const log = combat.log;

  useEffect(() => {
    if (step >= log.length - 1) { if (!done) { setDone(true); onDone?.(); } return; }
    timer.current = setTimeout(() => setStep((s) => s + 1), 900 / speed);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [step, speed, log.length, done, onDone]);

  const cur = step >= 0 ? log[step] : undefined;
  const aHp = cur ? cur.aHp : HP;
  const bHp = cur ? cur.bHp : HP;
  const round = cur ? cur.round : 1;
  const recent = useMemo(() => log.slice(Math.max(0, step - 2), step + 1).reverse(), [log, step]);
  const skip = () => { if (timer.current) clearTimeout(timer.current); setStep(log.length - 1); setDone(true); onDone?.(); };

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-semibold">전투</span>
        <span className="mono text-[13px] text-gold">ROUND {round} / {BALANCE.combat.rounds}</span>
      </div>
      <Fighter name={aName} hp={aHp} mine hit={cur && cur.actor === 'b' && cur.damage > 0 ? step : -1} />
      <div className="text-center mono text-[12px] text-muted">VS</div>
      <Fighter name={bName} hp={bHp} hit={cur && cur.actor === 'a' && cur.damage > 0 ? step : -1} />

      <Card className="flex-1 min-h-[130px] p-3 flex flex-col gap-1.5 overflow-hidden">
        {recent.map((e, i) => (
          <div key={step - i} className={`flex items-center justify-between text-[12.5px] ${i === 0 ? 'opacity-100 animate-reveal' : 'opacity-45'}`}>
            <span className={e.actor === 'a' ? 'text-gold-2' : 'text-blue'}>{e.label}</span>
            {e.damage > 0 && <span className={`mono ${e.kind === 'crit' || e.kind === 'skill' ? 'text-red' : 'text-text-2'}`}>−{e.damage}{e.kind === 'crit' ? ' ⚡' : e.kind === 'skill' ? ' ✦' : ''}</span>}
          </div>
        ))}
        {step < 0 && <div className="text-[13px] text-muted text-center my-auto">전투 시작…</div>}
      </Card>

      {!done && (
        <div className="flex gap-2.5">
          <Button variant="ghost" className="flex-1" onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}>배속 ×{speed}</Button>
          <Button variant="ghost" className="flex-1" onClick={skip}>스킵</Button>
        </div>
      )}
    </>
  );
}

function Fighter({ name, hp, mine, hit = -1 }: { name: string; hp: number; mine?: boolean; hit?: number }) {
  const pct = Math.max(0, (hp / HP) * 100);
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (hit < 0) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 300);
    return () => clearTimeout(t);
  }, [hit]);
  return (
    <Card className={`p-3.5 flex flex-col gap-2 ${shaking ? 'animate-shake' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold">{name}</span>
        <span className="mono text-[12px] text-text-3">{Math.max(0, Math.round(hp))} / {HP}</span>
      </div>
      <div className="h-[8px] rounded-full bg-surface-4 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: mine ? '#D9A227' : '#8FA6C4' }} />
      </div>
    </Card>
  );
}
