import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button, Card, Spinner } from '../ui/kit';

// Cut the route timeline into blade / guard / handle segments (cosmetic).
export function Parts() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: sword, isLoading } = useQuery({ queryKey: ['sword', id], queryFn: () => api.sword(id!), enabled: !!id });
  const [cut1, setCut1] = useState(58); // % end of blade
  const [cut2, setCut2] = useState(78); // % end of guard

  const save = useMutation({
    mutationFn: () => api.reforge(id!, { ...sword!.shape, parts: { blade: cut1 / 100, guard: (cut2 - cut1) / 100, handle: (100 - cut2) / 100 } }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['sword', id] }); nav(`/sword/${id}/workshop`); },
  });

  if (isLoading || !sword) return <Spinner label="타임라인 로딩" />;
  const totalKm = Math.max(1, Math.round(sword.shape.lengthScale / 0.08));
  const seg = (a: number, b: number) => ((b - a) / 100 * totalKm).toFixed(1);

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6 min-h-[100dvh]">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="text-[15px] text-muted">‹ 공방</button>
        <span className="text-[16px] font-semibold">부위 지정</span>
        <button onClick={() => { setCut1(58); setCut2(78); }} className="text-[13px] text-blue">자동 배치</button>
      </div>

      {/* timeline */}
      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-text-3">경로 타임라인 <span className="mono text-[11px] text-muted">{totalKm}km</span></span>
          <span className="text-[11.5px] text-muted">핸들로 자르기</span>
        </div>
        <div className="h-[34px] flex rounded-lg overflow-hidden border border-hair">
          <div style={{ width: `${cut1}%` }} className="bg-gold/30 flex items-center justify-center text-[11px] text-gold-2 font-semibold">검신 {seg(0, cut1)}km</div>
          <div style={{ width: `${cut2 - cut1}%` }} className="bg-blue/28 flex items-center justify-center text-[11px] text-blue font-semibold">가드</div>
          <div style={{ width: `${100 - cut2}%` }} className="bg-purple/24 flex items-center justify-center text-[11px] text-purple font-semibold">자루</div>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <label className="text-[11px] text-muted">검신 / 가드 경계</label>
          <input type="range" min={20} max={cut2 - 5} value={cut1} onChange={(e) => setCut1(Number(e.target.value))} className="w-full accent-[#D9A227]" />
          <label className="text-[11px] text-muted">가드 / 자루 경계</label>
          <input type="range" min={cut1 + 5} max={95} value={cut2} onChange={(e) => setCut2(Number(e.target.value))} className="w-full accent-[#8FA6C4]" />
        </div>
      </Card>

      {/* segments */}
      <div className="flex flex-col gap-2">
        <PartRow color="#D9A227" label="검신 — 앞 구간" km={seg(0, cut1)} />
        <PartRow color="#8FA6C4" label="가드 — 중간 교차" km={seg(cut1, cut2)} />
        <PartRow color="#B48CF0" label="자루 — 마지막 구간" km={seg(cut2, 100)} />
      </div>

      <p className="text-[11.5px] text-muted leading-relaxed">경로의 구간을 검신·가드·자루에 배치합니다. 외형 전용 — 스탯은 변하지 않습니다.</p>

      <div className="mt-auto flex gap-2.5">
        <Button variant="ghost" className="flex-1" onClick={() => nav(-1)}>되돌리기</Button>
        <Button className="flex-[1.6]" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? '적용 중…' : '배치 적용'}</Button>
      </div>
    </div>
  );
}

function PartRow({ color, label, km }: { color: string; label: string; km: string }) {
  return (
    <div className="bg-surface-2 border rounded-[12px] px-3.5 py-3 flex justify-between items-center" style={{ borderColor: `${color}55` }}>
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: color }} />
        <span className="text-[13px] font-medium">{label}</span>
      </div>
      <span className="mono text-[11px] text-text-3">{km}km</span>
    </div>
  );
}
