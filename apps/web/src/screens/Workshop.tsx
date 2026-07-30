import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BladeTransform } from '@hitrace/game-core';
import { api } from '../lib/api';
import { BladeSvg } from '../ui/BladeSvg';
import { Button, Card, Spinner } from '../ui/kit';

const DEFAULT_T: BladeTransform = { rotate: 0, flipH: false, flipV: false, mirror: false, scale: 1 };

export function Workshop() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: sword, isLoading } = useQuery({ queryKey: ['sword', id], queryFn: () => api.sword(id!), enabled: !!id });
  const [t, setT] = useState<BladeTransform>(DEFAULT_T);

  const save = useMutation({
    mutationFn: () => api.reforge(id!, { ...sword!.shape, transform: t }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['sword', id] }); await qc.invalidateQueries({ queryKey: ['swords'] }); nav(`/sword/${id}`); },
  });

  if (isLoading || !sword) return <Spinner label="공방 준비 중" />;
  const preview = { ...sword.shape, transform: t };
  const snap15 = (v: number) => Math.round(v / 15) * 15;

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6 min-h-[100dvh]">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="text-[15px] text-muted">‹ 취소</button>
        <span className="text-[16px] font-semibold">주조 공방</span>
        <button onClick={() => setT(DEFAULT_T)} className="text-[13px] text-blue">초기화</button>
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-[240px] rounded-[18px] border border-hair flex items-center justify-center relative overflow-hidden"
           style={{ background: 'radial-gradient(90% 60% at 50% 40%, #1B1710, #0E1014)' }}>
        <BladeSvg shape={preview} rarity={sword.rarity} width={150} height={300} glow />
        <div className="absolute top-3 left-3 bg-screen/80 border border-hair rounded-lg px-2.5 py-1.5 flex flex-col">
          <span className="text-[10px] text-muted">회전</span>
          <span className="mono text-[13px] text-gold">{t.rotate}°</span>
        </div>
        {t.mirror && (
          <div className="absolute bottom-3 left-3 right-3 flex justify-center">
            <span className="bg-purple/12 border border-purple/35 rounded-pill px-3.5 py-1.5 text-[12px] text-purple">미러 대칭 ON — 양날 미리보기</span>
          </div>
        )}
      </div>

      {/* Rotation slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-text-3">회전 <span className="mono text-[11px] text-muted">15° 스냅</span></span>
          <span className="mono text-[12px] text-text-2">{t.rotate}°</span>
        </div>
        <input type="range" min={-180} max={180} step={15} value={t.rotate}
               onChange={(e) => setT((p) => ({ ...p, rotate: snap15(Number(e.target.value)) }))}
               className="w-full accent-[#D9A227]" />
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-4 gap-2">
        <Toggle label="좌우 반전" active={t.flipH} onClick={() => setT((p) => ({ ...p, flipH: !p.flipH }))} />
        <Toggle label="상하 반전" active={t.flipV} onClick={() => setT((p) => ({ ...p, flipV: !p.flipV }))} />
        <Toggle label="미러 대칭" active={t.mirror} purple onClick={() => setT((p) => ({ ...p, mirror: !p.mirror }))} />
        <Toggle label={`스케일 ${Math.round(t.scale * 100)}%`} active={t.scale !== 1} onClick={() => setT((p) => ({ ...p, scale: p.scale >= 1.2 ? 0.8 : Math.round((p.scale + 0.1) * 10) / 10 }))} />
      </div>

      <p className="text-[11.5px] text-muted leading-relaxed">변형은 외형에만 작용합니다 — 스탯은 변하지 않습니다. 실제 왕복 코스로 만든 양날검만 도감에 "眞 양날"로 표기됩니다.</p>

      <div className="flex gap-2.5">
        <Button variant="ghost" className="flex-1" onClick={() => nav(`/sword/${id}/parts`)}>부위 지정</Button>
        <Button className="flex-[1.6]" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? '주조 중…' : '이대로 주조'}</Button>
      </div>
    </div>
  );
}

function Toggle({ label, active, onClick, purple }: { label: string; active: boolean; onClick: () => void; purple?: boolean }) {
  const color = purple ? '#B48CF0' : '#D9A227';
  return (
    <button onClick={onClick}
      className="pressable rounded-[12px] p-2.5 flex flex-col items-center justify-center gap-1 text-[11px] border"
      style={active ? { background: `${color}18`, borderColor: `${color}66`, color } : { background: '#14161B', borderColor: 'rgba(255,255,255,.08)', color: '#9AA1AC' }}>
      {label}
    </button>
  );
}
