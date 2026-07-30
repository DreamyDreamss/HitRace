import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeForgeScore, deriveMetrics, type GpsPoint } from '@hitrace/game-core';
import { useRunTracker } from '../lib/geoRun';
import { useRun } from '../store/run';
import { RouteTrace } from '../ui/RouteTrace';
import { Button, RarityChip } from '../ui/kit';
import { paceLabel } from '../ui/rarity';

function synthSensors(points: GpsPoint[]) {
  // Real GPS lacks cadence/HR; synthesize plausible streams until sensor integration.
  return {
    cadence: points.map((_, i) => 170 + Math.sin(i * 0.6) * 3),
    heartRate: points.map((_, i) => (i / points.length < 0.65 ? 152 : 120)),
    maxHeartRate: 190,
  };
}

export function Running() {
  const nav = useNavigate();
  const setTrack = useRun((s) => s.setTrack);
  const run = useRunTracker();

  const preview = useMemo(() => {
    if (run.points.length < 8) return null;
    const track = { points: run.points, ...synthSensors(run.points) };
    try {
      const m = deriveMetrics(track);
      const score = computeForgeScore(m, { repeatIndex: 0, isNewCourse: true });
      return { score: score.total, rarity: score.rarity };
    } catch { return null; }
  }, [run.points]);

  const finish = () => {
    run.stop();
    const track = { points: run.points, ...synthSensors(run.points) };
    setTrack(track);
    nav('/run/summary');
  };

  const idle = run.status === 'idle';

  return (
    <div className="min-h-[100dvh] flex flex-col gap-4 px-5 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <button onClick={() => nav('/')} className="text-[15px] text-muted">‹ 홈</button>
        <span className="text-[16px] font-semibold">실시간 주조</span>
        <span className="mono text-[12px] text-muted flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${run.status === 'running' ? 'bg-red animate-pulse2' : 'bg-surface-4'}`} />
          {run.gpsOk ? 'GPS' : 'NO GPS'}
        </span>
      </div>

      {/* Big live metrics */}
      <div className="grid grid-cols-3 gap-2.5">
        <Metric label="거리" value={run.distanceKm.toFixed(2)} unit="km" big />
        <Metric label="페이스" value={paceLabel(run.paceSecPerKm)} accent />
        <Metric label="시간" value={fmtTime(run.durationSec)} />
      </div>

      {/* Route so far */}
      <div className="rounded-[16px] overflow-hidden border border-hair relative">
        <RouteTrace points={run.points} height={230} />
        {run.points.length < 2 && (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-muted">
            {idle ? '시작하면 경로가 그려집니다' : '위치 수신 중…'}
          </div>
        )}
      </div>

      {/* Forge preview */}
      <div className="bg-surface-2 border border-hair rounded-[14px] px-4 py-3.5 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] text-muted">주조 예상</span>
          <span className="text-[13.5px]">{preview ? `스코어 ${preview.score}` : '1km 이상 달리면 예측이 시작됩니다'}</span>
        </div>
        {preview && <RarityChip rarity={preview.rarity} />}
      </div>

      {/* Controls */}
      <div className="mt-auto flex flex-col gap-2.5">
        {idle && (
          <>
            <Button onClick={run.start}>러닝 시작</Button>
            <div className="flex gap-2.5">
              <Button variant="ghost" className="flex-1" onClick={run.simulate}>데모 러닝</Button>
              <Button variant="ghost" className="flex-1" onClick={() => nav('/run/manual')}>실내 러닝</Button>
            </div>
          </>
        )}
        {run.status === 'running' && (
          <div className="flex gap-2.5">
            <Button variant="ghost" className="flex-1" onClick={run.pause}>일시정지</Button>
            <Button className="flex-[1.6]" disabled={run.distanceKm < 0.05} onClick={finish}>주조하기</Button>
          </div>
        )}
        {run.status === 'paused' && (
          <div className="flex gap-2.5">
            <Button variant="ghost" className="flex-1" onClick={run.start}>재개</Button>
            <Button className="flex-[1.6]" onClick={finish}>주조하기</Button>
          </div>
        )}
        {run.status === 'finished' && <Button onClick={finish}>요약 보기</Button>}
      </div>
    </div>
  );
}

function Metric({ label, value, unit, big, accent }: { label: string; value: string; unit?: string; big?: boolean; accent?: boolean }) {
  return (
    <div className="bg-surface-2 border border-hair rounded-[12px] px-3 py-3 flex flex-col gap-1">
      <span className="text-[11px] text-muted">{label}</span>
      <span className={`mono font-semibold ${big ? 'text-[20px]' : 'text-[17px]'} ${accent ? 'text-gold' : 'text-text'}`}>
        {value}{unit && <span className="text-[10px] text-muted ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
