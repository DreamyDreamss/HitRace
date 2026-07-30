import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { simulateCombat, type Combatant } from '@hitrace/game-core';
import { decodeReplay } from '../lib/replay';
import { DeviceShell } from '../ui/Shell';
import { Button } from '../ui/kit';
import { CombatStage } from '../ui/CombatStage';

// Public, login-free: replays a shared match identically from its encoded payload.
export function Replay() {
  const { data } = useParams();
  const nav = useNavigate();
  const [done, setDone] = useState(false);

  const payload = useMemo(() => (data ? decodeReplay(data) : null), [data]);
  const combat = useMemo(() => {
    if (!payload) return null;
    const a: Combatant = { id: 'a', name: payload.a.name, stats: payload.a.stats, cadence: payload.a.cadence, engravings: [] };
    const b: Combatant = { id: 'b', name: payload.b.name, stats: payload.b.stats, cadence: payload.b.cadence, engravings: [] };
    return simulateCombat(a, b, payload.seed);
  }, [payload]);

  if (!payload || !combat) {
    return (
      <DeviceShell nav={false}>
        <div className="min-h-[70dvh] flex flex-col items-center justify-center gap-4 text-center px-6">
          <p className="text-text-3 text-[14px]">잘못된 리플레이 링크입니다.</p>
          <Button onClick={() => nav('/')}>HitRace 열기</Button>
        </div>
      </DeviceShell>
    );
  }

  const won = combat.winner === 'a';
  return (
    <DeviceShell nav={false}>
      <div className="min-h-[100dvh] flex flex-col gap-4 px-5 pt-5 pb-6">
        <div className="text-center">
          <span className="eyebrow">SHARED REPLAY</span>
        </div>
        <CombatStage combat={combat} aName={payload.a.name} bName={payload.b.name} onDone={() => setDone(true)} />
        {done && (
          <div className="flex flex-col gap-3 animate-reveal">
            <div className="text-center text-[20px] font-bold text-gold">{won ? payload.a.name : payload.b.name} 승리</div>
            <Button onClick={() => nav('/')}>나도 달려서 검 만들기 →</Button>
          </div>
        )}
      </div>
    </DeviceShell>
  );
}
