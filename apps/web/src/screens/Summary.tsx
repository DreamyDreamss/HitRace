import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeForgeScore, deriveMetrics, runOreReward, runTicketReward } from '@hitrace/game-core';
import { api, ApiError } from '../lib/api';
import { enqueueRun, isNetworkError } from '../lib/offlineQueue';
import { haptics } from '../lib/haptics';
import { toast } from '../store/toast';
import { useRun } from '../store/run';
import { useSession } from '../store/session';
import { RouteTrace } from '../ui/RouteTrace';
import { Button, Card, CurrencyPill, RarityChip, SectionTitle } from '../ui/kit';
import { paceLabel } from '../ui/rarity';

export function Summary() {
  const nav = useNavigate();
  const track = useRun((s) => s.track);
  const setForge = useRun((s) => s.setForge);
  const refresh = useSession((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const derived = useMemo(() => {
    if (!track || track.points.length < 2) return null;
    const m = deriveMetrics(track);
    const score = computeForgeScore(m, { repeatIndex: 0, isNewCourse: true });
    return { m, score };
  }, [track]);

  if (!track || !derived) {
    return (
      <div className="min-h-[60dvh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-text-3 text-[14px]">표시할 러닝이 없습니다.</p>
        <Button variant="ghost" onClick={() => nav('/run')}>러닝하러 가기</Button>
      </div>
    );
  }

  const { m, score } = derived;
  const forge = async (doForge: boolean) => {
    setBusy(true); setErr(null);
    try {
      const res = await api.submitRun(track, doForge);
      await refresh();
      if (doForge && res.sword) {
        haptics.forge();
        setForge(res);
        nav(`/forge/${res.sword.id}`);
      } else {
        toast.success('러닝 기록이 저장되었습니다');
        nav('/');
      }
    } catch (e) {
      if (isNetworkError(e)) {
        // Offline: queue the run locally; it syncs when the connection returns.
        enqueueRun(track);
        toast.info('오프라인 — 러닝을 저장했어요. 연결되면 자동 동기화됩니다.');
        nav('/');
        return;
      }
      if (e instanceof ApiError && e.code === 'daily_forge_cap') setErr('오늘 주조 한도(2자루)를 모두 사용했어요. 기록만 저장할 수 있습니다.');
      else if (e instanceof ApiError && e.code.startsWith('run_rejected')) setErr('주조 조건을 충족하지 못했어요 (최소 1km·10분).');
      else setErr('문제가 발생했습니다. 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <span className="text-[22px] font-semibold tracking-tight">러닝 완료</span>
        <RarityChip rarity={score.rarity} />
      </div>

      <div className="rounded-[16px] overflow-hidden border border-hair">
        <RouteTrace points={track.points} height={200} />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Mini label="거리" value={m.distanceKm.toFixed(2)} unit="km" />
        <Mini label="페이스" value={paceLabel(m.avgPaceSecPerKm)} accent />
        <Mini label="고도" value={String(Math.round(m.elevationGainM))} unit="m" />
        <Mini label="케이던스" value={String(Math.round(m.avgCadence))} />
      </div>

      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[13.5px] font-semibold">주조 스코어</span>
          <span className="mono text-[20px] font-bold text-purple">{score.total} · {score.rarity}</span>
        </div>
        <div className="flex flex-col gap-1.5 text-[12px] text-text-3">
          <Row label="기본 (거리·시간)" v={score.breakdown.base} />
          <Row label="페이스 보너스" v={score.breakdown.paceBonus} />
          <Row label="신규 코스 탐험" v={score.breakdown.explorationBonus} />
          <Row label="네거티브 스플릿" v={score.breakdown.negativeSplitBonus} />
          <Row label="고도 보너스" v={score.breakdown.elevationBonus} />
        </div>
      </Card>

      <div className="bg-gold/10 border border-gold/35 rounded-[14px] px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] text-gold-2">획득 예정</span>
        <div className="flex items-center gap-1.5">
          <CurrencyPill kind="ore" value={runOreReward(m.distanceKm)} />
          {runTicketReward(m.distanceKm) > 0 && <CurrencyPill kind="forgeTicket" value={runTicketReward(m.distanceKm)} />}
        </div>
      </div>

      {err && <p className="text-[12.5px] text-red text-center">{err}</p>}

      <div className="flex gap-2.5 mt-1">
        <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => forge(false)}>기록만 저장</Button>
        <Button className="flex-[1.6]" disabled={busy} onClick={() => forge(true)}>{busy ? '주조 중…' : '검 주조하기'}</Button>
      </div>
    </div>
  );
}

function Mini({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="bg-surface-2 border border-hair rounded-[12px] px-2.5 py-2.5 flex flex-col gap-0.5">
      <span className="text-[10.5px] text-muted">{label}</span>
      <span className={`mono text-[15px] font-semibold ${accent ? 'text-gold' : 'text-text'}`}>{value}{unit && <span className="text-[9px] text-muted">{unit}</span>}</span>
    </div>
  );
}
function Row({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={`mono ${v > 0 ? 'text-gold' : 'text-muted'}`}>{v > 0 ? `+${v}` : v}</span>
    </div>
  );
}
