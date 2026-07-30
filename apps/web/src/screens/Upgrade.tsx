import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyUpgrade, computeCP, streakBonus, upgradeCost, upgradeSuccessChance, type Stats } from '@hitrace/game-core';
import { api, ApiError } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useSession } from '../store/session';
import { Button, Card, CurrencyPill, RarityChip, Spinner } from '../ui/kit';
import { STAT_META } from '../ui/rarity';

const WEEKLY_KM = 18.6; // demo weekly running total (drives the runner bonus)

export function Upgrade() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { me, refresh } = useSession();
  const { data: sword, isLoading } = useQuery({ queryKey: ['sword', id], queryFn: () => api.sword(id!), enabled: !!id });
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const upgrade = useMutation({
    mutationFn: () => api.upgrade(id!, WEEKLY_KM),
    onSuccess: async (res) => {
      res.success ? haptics.success() : haptics.fail();
      setFlash({ ok: res.success, msg: res.success ? `강화 성공! +${res.sword.plus}` : '강화 실패 — 수치 −1' });
      await refresh();
      await qc.invalidateQueries({ queryKey: ['sword', id] });
      await qc.invalidateQueries({ queryKey: ['swords'] });
    },
    onError: (e) => {
      setFlash({ ok: false, msg: e instanceof ApiError && e.code === 'insufficient_ore' ? '철광석이 부족합니다.' : '오류가 발생했습니다.' });
    },
  });

  if (isLoading || !sword) return <Spinner label="강화대 준비 중" />;

  const streak = me?.user.streakDays ?? 0;
  const cost = upgradeCost(sword.plus);
  const chance = upgradeSuccessChance(sword.plus, WEEKLY_KM, streak);
  const next: Stats = applyUpgrade(sword.stats, sword.plus);
  const ore = me?.wallet.ore ?? 0;
  const canAfford = ore >= cost;

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="text-[15px] text-muted">‹ 검 상세</button>
        <CurrencyPill kind="ore" value={ore} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RarityChip rarity={sword.rarity} plus={sword.plus} />
          <span className="text-[16px] font-semibold">{sword.name}</span>
        </div>
        <span className="mono text-[13px] text-gold">+{sword.plus} → +{sword.plus + 1}</span>
      </div>

      {/* stat deltas */}
      <Card className="p-4 flex flex-col gap-2.5">
        {STAT_META.map((s) => {
          const cur = sword.stats[s.key];
          const nx = next[s.key];
          return (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-[13px] text-text-3">{s.ko}</span>
              <span className="mono text-[13px]">
                <span className="text-text-2">{cur}</span>
                <span className="text-muted mx-1.5">→</span>
                <span style={{ color: s.color }}>{nx}</span>
                <span className="text-gold-2 text-[11px] ml-1.5">+{nx - cur}</span>
              </span>
            </div>
          );
        })}
        <div className="flex items-center justify-between pt-2 border-t border-hair">
          <span className="text-[13px] text-text-3">CP</span>
          <span className="mono text-[13px] text-gold">{sword.cp} → {computeCP(next)}</span>
        </div>
      </Card>

      {/* success */}
      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-text-3">성공 확률</span>
          <span className="mono text-[18px] font-bold text-gold">{Math.round(chance * 100)}%</span>
        </div>
        <div className="h-[6px] rounded-full bg-surface-4 overflow-hidden">
          <div className="h-full bg-gold rounded-full" style={{ width: `${chance * 100}%` }} />
        </div>
        <p className="text-[11.5px] text-muted leading-relaxed">
          실패 시 등급 유지, 강화 수치 −1. 이번 주 러닝 {WEEKLY_KM}km 러너 보정
          {streak >= 2 && <> · 🔥 연속 {streak}일 숫돌 <b className="text-gold-2">+{Math.round(streakBonus(streak) * 100)}%</b></>} 적용 중.
        </p>
      </Card>

      {flash && (
        <div className={`text-center text-[14px] font-semibold ${flash.ok ? 'text-gold' : 'text-red'} animate-reveal`}>{flash.msg}</div>
      )}

      <Button disabled={!canAfford || upgrade.isPending} onClick={() => upgrade.mutate()}>
        {upgrade.isPending ? '강화 중…' : canAfford ? `강화하기 · 철광석 ${cost}` : `철광석 ${cost - ore} 부족`}
      </Button>
      {!canAfford && <span className="text-[11px] text-muted text-center">더 달리면 철광석을 모을 수 있어요.</span>}
    </div>
  );
}
