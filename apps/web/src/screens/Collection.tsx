import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Rarity, Sword } from '@hitrace/game-core';
import { dismantleYield } from '@hitrace/game-core';
import { api } from '../lib/api';
import { useSession } from '../store/session';
import { BladeSvg } from '../ui/BladeSvg';
import { Button, Card, RarityChip, SectionTitle, Spinner } from '../ui/kit';

const RARITY_ORDER: Rarity[] = ['LEGEND', 'SR', 'R', 'N'];
type Filter = 'all' | Rarity;

export function Collection() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { me, refresh } = useSession();
  const { data: swords, isLoading } = useQuery({ queryKey: ['swords'], queryFn: api.swords });
  const [filter, setFilter] = useState<Filter>('all');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const equippedId = me?.user.equippedSwordId;

  const dismantle = useMutation({
    mutationFn: (ids: string[]) => api.dismantle(ids),
    onSuccess: async () => {
      setSelected(new Set());
      setSelecting(false);
      await qc.invalidateQueries({ queryKey: ['swords'] });
      await refresh();
    },
  });

  const filtered = useMemo(() => {
    const list = swords ?? [];
    return filter === 'all' ? list : list.filter((s) => s.rarity === filter);
  }, [swords, filter]);

  if (isLoading) return <Spinner label="보관함 여는 중" />;

  const selectableCount = filtered.filter((s) => s.id !== equippedId).length;
  const selectedYield = (swords ?? [])
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + dismantleYield(s.rarity, s.plus), 0);

  const toggle = (s: Sword) => {
    if (s.id === equippedId) return;
    if (!selecting) { nav(`/sword/${s.id}`); return; }
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(s.id) ? next.delete(s.id) : next.add(s.id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
      <SectionTitle
        eyebrow={`보관함 ${swords?.length ?? 0}/60`}
        title="컬렉션"
        right={
          <button className="text-[13px] text-blue font-semibold" onClick={() => { setSelecting((v) => !v); setSelected(new Set()); }}>
            {selecting ? '취소' : '분해'}
          </button>
        }
      />

      {/* filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(['all', ...RARITY_ORDER] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-pill text-[12px] border ${filter === f ? 'bg-surface-3 border-hair-2 text-text' : 'border-hair text-muted'}`}
          >
            {f === 'all' ? '전체' : f}
          </button>
        ))}
      </div>

      {/* grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {filtered.map((s) => {
          const isEquipped = s.id === equippedId;
          const isSel = selected.has(s.id);
          return (
            <Card
              key={s.id}
              onClick={() => toggle(s)}
              className={`p-3 flex flex-col items-center gap-2 relative ${isSel ? '!border-gold' : ''} ${selecting && isEquipped ? 'opacity-40' : ''}`}
            >
              {isEquipped && <span className="absolute top-2 left-2 mono text-[9px] text-gold">장착</span>}
              {selecting && !isEquipped && (
                <span className={`absolute top-2 right-2 w-4 h-4 rounded-full border ${isSel ? 'bg-gold border-gold' : 'border-hair-2'}`} />
              )}
              <BladeSvg shape={s.shape} rarity={s.rarity} width={54} height={130} glow={s.rarity === 'LEGEND'} />
              <div className="flex flex-col items-center gap-1 w-full">
                <span className="text-[13px] font-medium truncate w-full text-center">{s.name}</span>
                <div className="flex items-center gap-1.5">
                  <RarityChip rarity={s.rarity} plus={s.plus} />
                  <span className="mono text-[10px] text-muted">CP {s.cp}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-text-3 text-[14px]">아직 검이 없습니다.</p>
          <Button onClick={() => nav('/run')}>달려서 주조</Button>
        </div>
      )}

      {selecting ? (
        <div className="sticky bottom-2 flex flex-col gap-2">
          <Button
            variant="danger"
            disabled={selected.size === 0 || dismantle.isPending}
            onClick={() => dismantle.mutate([...selected])}
          >
            {selected.size === 0 ? `분해할 검 선택 (${selectableCount})` : `${selected.size}자루 분해 → 철광석 ×${selectedYield}`}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2.5">
          <Button variant="ghost" className="flex-1" onClick={() => nav('/run')}>+ 달려서 주조</Button>
          <Button variant="ghost" className="flex-1" onClick={() => nav('/forge/fusion')}>합주조</Button>
        </div>
      )}
    </div>
  );
}
