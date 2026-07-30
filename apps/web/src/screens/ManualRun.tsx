import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useSession } from '../store/session';
import { Button, Card } from '../ui/kit';
import { paceLabel } from '../ui/rarity';

// No-GPS / treadmill mode: enter distance + pace → procedural (capped) blade.
export function ManualRun() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { refresh } = useSession();
  const [km, setKm] = useState(5);
  const [paceSec, setPaceSec] = useState(330); // 5'30"
  const [err, setErr] = useState<string | null>(null);

  const forge = useMutation({
    mutationFn: () => api.manualRun(km, paceSec),
    onSuccess: async (res) => {
      haptics.forge();
      await refresh();
      await qc.invalidateQueries({ queryKey: ['swords'] });
      nav(`/forge/${res.sword.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'daily_forge_cap') setErr('오늘 주조 한도(2자루)를 모두 사용했어요.');
      else if (e instanceof ApiError && e.code === 'below_min_distance') setErr('최소 1km 이상이어야 합니다.');
      else setErr('문제가 발생했습니다.');
    },
  });

  return (
    <div className="flex flex-col gap-5 px-5 pt-5 pb-6 min-h-[100dvh]">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="text-[15px] text-muted">‹ 러닝</button>
        <span className="text-[16px] font-semibold">실내 러닝</span>
        <span className="w-8" />
      </div>

      <p className="text-[12.5px] text-text-3 leading-relaxed">
        트레드밀·실내에서 GPS 없이 달렸다면 거리와 페이스를 입력하세요. 절제된 형태의 단련검이 주조됩니다.
        <span className="text-muted"> (실외 GPS 러닝만 LEGEND·진 양날·도감 등재가 가능합니다.)</span>
      </p>

      {/* distance */}
      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-text-3">거리</span>
          <span className="mono text-[18px] font-semibold text-gold">{km.toFixed(1)}<span className="text-[11px] text-muted ml-0.5">km</span></span>
        </div>
        <input type="range" min={1} max={30} step={0.5} value={km} onChange={(e) => setKm(Number(e.target.value))} className="w-full accent-[#D9A227]" aria-label="거리" />
      </Card>

      {/* pace */}
      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-text-3">페이스 <span className="mono text-[11px] text-muted">/km</span></span>
          <span className="mono text-[18px] font-semibold text-blue">{paceLabel(paceSec)}</span>
        </div>
        <input type="range" min={180} max={480} step={5} value={paceSec} onChange={(e) => setPaceSec(Number(e.target.value))} className="w-full accent-[#8FA6C4]" aria-label="페이스" />
      </Card>

      <Card className="p-3.5 flex items-center justify-between text-[12.5px]">
        <span className="text-text-3">예상 시간</span>
        <span className="mono text-text-2">{Math.floor((km * paceSec) / 60)}분</span>
      </Card>

      {err && <p className="text-[12.5px] text-red text-center">{err}</p>}

      <Button className="mt-auto" disabled={forge.isPending} onClick={() => forge.mutate()}>
        {forge.isPending ? '주조 중…' : '단련검 주조'}
      </Button>
    </div>
  );
}
