import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { previewFusion, type Sword } from '@hitrace/game-core';
import { api, ApiError } from '../lib/api';
import { BladeSvg } from '../ui/BladeSvg';
import { Button, Card, RarityChip, Spinner } from '../ui/kit';

const RANK: Record<string, number> = { N: 0, R: 1, SR: 2, LEGEND: 3 };

export function Fusion() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: swords, isLoading } = useQuery({ queryKey: ['swords'], queryFn: api.swords });
  const [pick, setPick] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const eligible = (swords ?? []).filter((s) => RANK[s.rarity]! >= 2); // SR+
  const selected = useMemo(() => pick.map((id) => eligible.find((s) => s.id === id)).filter(Boolean) as Sword[], [pick, eligible]);
  const preview = selected.length === 2 ? previewFusion(selected[0]!, selected[1]!) : null;

  const fuse = useMutation({
    mutationFn: () => api.fusion([pick[0]!, pick[1]!]),
    onSuccess: async (res) => { await qc.invalidateQueries({ queryKey: ['swords'] }); nav(`/forge/${res.sword.id}`); },
    onError: (e) => setErr(e instanceof ApiError && e.code === 'cannot_fuse_equipped' ? '장착 중인 검은 합주조할 수 없습니다.' : '합주조에 실패했습니다.'),
  });

  const toggle = (id: string) => {
    setErr(null);
    setPick((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1]!, id] : [...prev, id]);
  };

  if (isLoading) return <Spinner label="공방 준비 중" />;

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6 min-h-[100dvh]">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="text-[15px] text-muted">‹ 공방</button>
        <span className="text-[16px] font-semibold">합주조</span>
        <span className="mono text-[12px] text-text-3">SR+ 2자루 소모</span>
      </div>

      {/* preview */}
      <div className="min-h-[190px] rounded-[18px] border border-hair flex items-center justify-center relative overflow-hidden"
           style={{ background: 'radial-gradient(90% 60% at 50% 42%, #1D1512, #0E1014)' }}>
        {preview && selected[0] ? (
          <div className="flex flex-col items-center gap-2 animate-reveal">
            <BladeSvg shape={selected[0].shape} rarity={selected[0].rarity} width={110} height={210} glow />
            <div className="flex items-center gap-2">
              <span className="mono text-[12px] text-text-2">예상 CP {preview.cp.toLocaleString()}</span>
              <span className="bg-red/10 border border-red/35 rounded-lg px-2 py-1 mono text-[11px] text-red">가중평균 −10%</span>
            </div>
          </div>
        ) : (
          <span className="text-[13px] text-muted">SR 이상 검 2자루를 선택하세요</span>
        )}
      </div>

      {/* eligible list */}
      <div className="flex flex-col gap-2">
        <span className="eyebrow">SR+ 보유 검 {eligible.length}</span>
        {eligible.length < 2 && <p className="text-[12.5px] text-muted">합주조에는 SR 이상 검이 2자루 필요합니다.</p>}
        <div className="grid grid-cols-2 gap-2.5">
          {eligible.map((s) => {
            const on = pick.includes(s.id);
            const order = pick.indexOf(s.id);
            return (
              <Card key={s.id} onClick={() => toggle(s.id)} className={`p-3 flex items-center gap-2.5 relative ${on ? '!border-gold' : ''}`}>
                {on && <span className="absolute top-2 right-2 mono text-[10px] text-gold">{order === 0 ? '검신' : '가드·자루'}</span>}
                <BladeSvg shape={s.shape} rarity={s.rarity} width={34} height={82} />
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[13px] font-medium truncate">{s.name}</span>
                  <div className="flex items-center gap-1.5"><RarityChip rarity={s.rarity} plus={s.plus} /><span className="mono text-[10px] text-muted">CP {s.cp}</span></div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {selected.length === 2 && (
        <div className="bg-surface-2 border border-hair rounded-[12px] px-4 py-3 flex flex-col gap-1.5 text-[12px] text-text-3">
          <div className="flex justify-between"><span>소모</span><span className="mono text-red truncate ml-2">{selected[0]!.name} · {selected[1]!.name}</span></div>
          <div className="flex justify-between"><span>결과 등급</span><span className="mono text-text-2">{selected[0]!.rarity === 'LEGEND' || selected[1]!.rarity === 'LEGEND' ? 'LEGEND' : 'SR'}</span></div>
        </div>
      )}

      {err && <p className="text-[12.5px] text-red text-center">{err}</p>}

      <Button className="mt-auto" disabled={selected.length !== 2 || fuse.isPending} onClick={() => fuse.mutate()}>
        {fuse.isPending ? '합주조 중…' : '합주조 시작 (복구 불가)'}
      </Button>
    </div>
  );
}
