import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useRun } from '../store/run';
import { BladeSvg } from '../ui/BladeSvg';
import { Button, Card, StatBars } from '../ui/kit';
import { RARITY_COLOR } from '../ui/rarity';

export function ForgeResult() {
  const nav = useNavigate();
  const { swordId } = useParams();
  const fromStore = useRun((s) => s.forgedSword);
  const clear = useRun((s) => s.clear);
  const [revealed, setRevealed] = useState(false);

  const { data: sword } = useQuery({
    queryKey: ['sword', swordId],
    queryFn: () => api.sword(swordId!),
    initialData: fromStore && fromStore.id === swordId ? fromStore : undefined,
    enabled: !!swordId,
  });

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 350);
    return () => clearTimeout(t);
  }, []);

  if (!sword) return <div className="min-h-[60dvh] flex items-center justify-center text-muted">주조 중…</div>;
  const c = RARITY_COLOR[sword.rarity];

  return (
    <div className="min-h-[100dvh] flex flex-col gap-5 px-5 pt-6 pb-6">
      <div className="text-center flex flex-col gap-1">
        <span className="mono text-[12px] tracking-[0.18em]" style={{ color: c }}>FORGED · {sword.rarity}</span>
        <span className="text-[13px] text-text-3">달린 경로가 검이 되었습니다</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="relative" style={{ filter: `drop-shadow(0 0 24px ${c}55)` }}>
          {revealed && <span className="absolute inset-0 rounded-full animate-spark" style={{ background: `radial-gradient(circle, ${c}66, transparent 60%)` }} />}
          <div className={revealed ? 'animate-forgeIn' : 'opacity-0'}>
            <BladeSvg shape={sword.shape} rarity={sword.rarity} width={150} height={330} glow />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sword.shape.trueDoubleEdge && <span className="mono text-[11px] text-gold-2">眞 양날</span>}
          {sword.shape.procedural && <span className="mono text-[11px] text-muted">실내 단련</span>}
          <span className="mono text-[13px]" style={{ color: c }}>CP {sword.cp.toLocaleString()}</span>
        </div>
      </div>

      <Card className="p-4 flex flex-col gap-3">
        <NameField initial={sword.name} />
        <StatBars stats={sword.stats} />
      </Card>

      <div className="flex gap-2.5">
        <Button variant="ghost" className="flex-1" onClick={() => { clear(); nav('/collection'); }}>보관함</Button>
        <Button className="flex-[1.6]" onClick={() => { clear(); nav('/'); }}>완료</Button>
      </div>
    </div>
  );
}

function NameField({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted">이름 · 코스명에서 자동 추천</span>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-transparent text-[18px] font-semibold text-text outline-none border-b border-hair focus:border-gold pb-1"
      />
    </div>
  );
}
