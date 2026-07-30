import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BALANCE } from '@hitrace/game-core';
import { api, ApiError, type GachaResult } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useSession } from '../store/session';
import { Button, Card, CurrencyPill, SectionTitle } from '../ui/kit';

const TIER_META: Record<string, { ko: string; color: string }> = {
  legendMaterial: { ko: '전설 재료', color: '#D9A227' },
  engraveStone: { ko: '각인석', color: '#B48CF0' },
  upgradeOre: { ko: '강화 광석', color: '#8FA6C4' },
};

export function Gacha() {
  const { me, refresh } = useSession();
  const [result, setResult] = useState<GachaResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pull = useMutation({
    mutationFn: (count: 1 | 10) => api.gacha(count),
    onSuccess: async (res) => { res.pulls.some((p) => p.tier === 'legendMaterial') ? haptics.forge() : haptics.tap(); setResult(res); setErr(null); await refresh(); },
    onError: (e) => setErr(e instanceof ApiError && e.code === 'insufficient_tickets' ? '주조 티켓이 부족합니다. 3km 이상 달리면 티켓을 받아요.' : '오류가 발생했습니다.'),
  });

  const tickets = me?.wallet.forgeTicket ?? 0;
  const pity = me?.user.gachaPity ?? 0;
  const pityMax = BALANCE.gacha.pityCount;

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
      <SectionTitle eyebrow="ORE VEIN" title="주조 광맥" right={<CurrencyPill kind="forgeTicket" value={tickets} />} />

      {/* pity */}
      <Card className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-text-3">천장까지</span>
          <span className="mono text-[12px] text-gold-2">{pity} / {pityMax}</span>
        </div>
        <div className="h-[6px] rounded-full bg-surface-4 overflow-hidden">
          <div className="h-full bg-gold rounded-full" style={{ width: `${(pity / pityMax) * 100}%` }} />
        </div>
      </Card>

      {/* reveal */}
      <div className="min-h-[200px] rounded-[16px] border border-hair bg-deep p-4 flex items-center justify-center">
        {result ? (
          <div className="grid grid-cols-5 gap-2 w-full">
            {result.pulls.map((p, i) => {
              const meta = TIER_META[p.tier]!;
              return (
                <div key={i} className="aspect-square rounded-lg flex flex-col items-center justify-center gap-1 animate-pop" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}55`, animationDelay: `${i * 55}ms` }}>
                  <span className="w-3 h-3 rounded-full" style={{ background: meta.color }} />
                  {p.pity && <span className="mono text-[8px] text-gold">천장</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-[13px] text-muted leading-relaxed">
            검은 가챠에서 나오지 않습니다 — 재료·각인만.<br />검은 오직 달려서.
          </div>
        )}
      </div>

      {result && (
        <div className="flex justify-center gap-3 text-[12px] text-text-3">
          {result.grants.ore > 0 && <span className="mono">광석 +{result.grants.ore}</span>}
          {result.grants.engraveStone > 0 && <span className="mono text-purple">각인석 +{result.grants.engraveStone}</span>}
          {result.grants.legendMaterial > 0 && <span className="mono text-gold">전설재료 +{result.grants.legendMaterial}</span>}
        </div>
      )}

      {/* rates */}
      <Card className="p-4 flex flex-col gap-2 text-[12px]">
        <span className="eyebrow">DROP RATES</span>
        {Object.entries(BALANCE.gacha.rates).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: TIER_META[k]?.color }} />{TIER_META[k]?.ko}</span>
            <span className="mono text-text-3">{(v * 100).toFixed(1)}%</span>
          </div>
        ))}
      </Card>

      {err && <p className="text-[12.5px] text-red text-center">{err}</p>}

      <div className="flex gap-2.5">
        <Button variant="ghost" className="flex-1" disabled={tickets < 1 || pull.isPending} onClick={() => pull.mutate(1)}>1회 · 티켓 1</Button>
        <Button className="flex-[1.4]" disabled={tickets < 9 || pull.isPending} onClick={() => pull.mutate(10)}>{pull.isPending ? '주조 중…' : '10연차 · 티켓 9'}</Button>
      </div>
    </div>
  );
}
