import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENGRAVING_CATALOG, activeSynergies } from '@hitrace/game-core';
import { api, ApiError } from '../lib/api';
import { haptics } from '../lib/haptics';
import { toast } from '../store/toast';
import { useSession } from '../store/session';
import { BladeSvg } from '../ui/BladeSvg';
import { Button, Card, RarityChip, Spinner, StatBars } from '../ui/kit';
import { RARITY_COLOR } from '../ui/rarity';

export function SwordDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { me, refresh } = useSession();
  const { data: sword, isLoading } = useQuery({ queryKey: ['sword', id], queryFn: () => api.sword(id!), enabled: !!id });

  const [pickSlot, setPickSlot] = useState<number | null>(null);
  const equip = useMutation({
    mutationFn: () => api.equip(id!),
    onSuccess: async () => { await refresh(); await qc.invalidateQueries({ queryKey: ['swords'] }); },
  });
  const engrave = useMutation({
    mutationFn: (v: { slot: number; engravingId: string }) => api.engrave(id!, v.slot, v.engravingId),
    onSuccess: async (res) => {
      haptics.success();
      setPickSlot(null);
      if (res.synergies.length) toast.success(`${res.synergies[0]!.name} 세트 발동!`);
      await refresh();
      await qc.invalidateQueries({ queryKey: ['sword', id] });
      await qc.invalidateQueries({ queryKey: ['swords'] });
    },
    onError: (e) => toast.error(e instanceof ApiError && e.code === 'insufficient_engrave_stones' ? '각인석이 부족합니다.' : '각인에 실패했습니다.'),
  });
  const dismantle = useMutation({
    mutationFn: () => api.dismantle([id!]),
    onSuccess: async () => { await refresh(); await qc.invalidateQueries({ queryKey: ['swords'] }); nav('/collection'); },
  });

  if (isLoading || !sword) return <Spinner label="검 여는 중" />;
  const isEquipped = me?.user.equippedSwordId === sword.id;
  const c = RARITY_COLOR[sword.rarity];

  return (
    <div className="flex flex-col gap-5 px-5 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="text-[15px] text-muted">‹ 보관함</button>
        {isEquipped && <span className="text-[13px] text-gold">장착 중</span>}
      </div>

      <div className="flex gap-4 items-center">
        <div style={{ filter: `drop-shadow(0 0 18px ${c}44)` }}>
          <BladeSvg shape={sword.shape} rarity={sword.rarity} width={92} height={220} glow />
        </div>
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <RarityChip rarity={sword.rarity} plus={sword.plus} />
            {sword.shape.trueDoubleEdge && <span className="mono text-[10px] text-gold-2">眞 양날</span>}
          </div>
          <h1 className="text-[20px] font-semibold">{sword.name}</h1>
          <span className="mono text-[13px]" style={{ color: c }}>CP {sword.cp.toLocaleString()}</span>
          <span className="mono text-[10.5px] text-muted">{sword.shape.style}</span>
        </div>
      </div>

      <Card className="p-4"><StatBars stats={sword.stats} /></Card>

      {/* Engravings */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="eyebrow">ENGRAVINGS</span>
          {activeSynergies(sword.engravings).map((s) => (
            <span key={s.set} className="mono text-[10px] text-purple">✦ {s.name}</span>
          ))}
        </div>
        <div className="flex gap-2.5">
          {sword.engravings.length === 0 && <span className="text-[12.5px] text-muted">이 등급은 각인 슬롯이 없습니다.</span>}
          {sword.engravings.map((e, i) => (
            <button key={i} onClick={() => setPickSlot(i)}
              className="pressable flex-1 aspect-square bg-surface-2 border border-dashed border-hair-2 rounded-[14px] flex flex-col items-center justify-center gap-1">
              {e ? (
                <>
                  <span className="text-[12px] font-medium text-center px-1">{e.name}</span>
                  <RarityChip rarity={e.rarity} />
                </>
              ) : (
                <>
                  <span className="text-[20px] text-muted">+</span>
                  <span className="text-[10px] text-muted">각인</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Engraving picker */}
      {pickSlot !== null && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end justify-center" onClick={() => setPickSlot(null)}>
          <div className="w-full max-w-[440px] bg-screen border-t border-hair rounded-t-[20px] p-5 flex flex-col gap-3 animate-reveal" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold">각인 선택 · 슬롯 {pickSlot + 1}</span>
              <span className="text-[12px] text-purple">보유 각인석 {me?.wallet.engraveStone ?? 0}</span>
            </div>
            {ENGRAVING_CATALOG.map((def) => {
              const afford = (me?.wallet.engraveStone ?? 0) >= def.cost;
              return (
                <button key={def.id} disabled={!afford || engrave.isPending}
                  onClick={() => engrave.mutate({ slot: pickSlot, engravingId: def.id })}
                  className={`pressable flex items-center justify-between px-4 py-3 rounded-[12px] bg-surface-2 border border-hair ${!afford ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <RarityChip rarity={def.rarity} />
                    <span className="text-[13.5px]">{def.name}</span>
                  </div>
                  <span className="mono text-[12px] text-purple">각인석 {def.cost}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5 mt-1">
        <div className="flex gap-2.5">
          <Button className="flex-[1.6]" onClick={() => nav(`/sword/${sword.id}/upgrade`)}>강화하기</Button>
          <Button variant="ghost" className="flex-1" onClick={() => nav(`/sword/${sword.id}/workshop`)}>공방</Button>
        </div>
        <div className="flex gap-2.5">
          <Button variant="ghost" className="flex-1" disabled={isEquipped || equip.isPending} onClick={() => equip.mutate()}>
            {isEquipped ? '장착됨' : '장착'}
          </Button>
          <Button variant="danger" className="flex-1" disabled={isEquipped || dismantle.isPending} onClick={() => dismantle.mutate()}>
            분해
          </Button>
        </div>
        {isEquipped && <span className="text-[11px] text-muted text-center">장착 중인 검은 분해할 수 없습니다.</span>}
      </div>
    </div>
  );
}
