import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tierFromRp } from '@hitrace/game-core';
import { api, type MatchResponse } from '../lib/api';
import { useSession } from '../store/session';
import { usePvp } from '../store/pvp';
import { BladeSvg } from '../ui/BladeSvg';
import { Button, Card, Spinner } from '../ui/kit';

type Phase = 'idle' | 'searching' | 'found' | 'resolving';

export function Matching() {
  const nav = useNavigate();
  const { me } = useSession();
  const setResult = usePvp((s) => s.setResult);
  const [phase, setPhase] = useState<Phase>('idle');
  const [waitSec, setWaitSec] = useState(0);
  const [match, setMatch] = useState<MatchResponse['opponent'] | null>(null);
  const [band, setBand] = useState(0.08);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const equipped = me?.equipped;
  const tier = tierFromRp(me?.user.rankRp ?? 0);

  const search = () => {
    setPhase('searching'); setErr(null); setWaitSec(0);
    let t = 0;
    timer.current = setInterval(async () => {
      t += 1; setWaitSec(t);
      try {
        const res = await api.match(t);
        setBand(res.band);
        if (res.found && res.opponent) {
          if (timer.current) clearInterval(timer.current);
          setMatch(res.opponent);
          setPhase('found');
        } else if (t > 6) {
          if (timer.current) clearInterval(timer.current);
          setErr('상대를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.');
          setPhase('idle');
        }
      } catch {
        if (timer.current) clearInterval(timer.current);
        setErr('매칭 오류'); setPhase('idle');
      }
    }, 500);
  };

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const startBattle = async () => {
    if (!match) return;
    setPhase('resolving');
    try {
      const res = await api.resolve(match.id);
      setResult(res, equipped?.name ?? '내 검');
      nav(`/pvp/${res.matchId}`);
    } catch {
      setErr('전투를 시작할 수 없습니다.'); setPhase('found');
    }
  };

  return (
    <div className="flex flex-col gap-5 px-5 pt-5 pb-6 min-h-[100dvh]">
      <div className="flex items-center justify-between">
        <span className="text-[22px] font-semibold tracking-tight">랭크전</span>
        <span className="mono text-[13px] text-gold">{tier.label} · {me?.user.rankRp ?? 0} RP</span>
      </div>

      {/* my sword */}
      {equipped && (
        <Card className="p-4 flex items-center gap-4">
          <BladeSvg shape={equipped.shape} rarity={equipped.rarity} width={56} height={130} glow={equipped.rarity === 'LEGEND'} />
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold">{equipped.name}</span>
            <span className="mono text-[13px] text-gold">CP {equipped.cp.toLocaleString()}</span>
          </div>
        </Card>
      )}

      {/* center state */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        {phase === 'idle' && <p className="text-[13px] text-muted text-center">비슷한 실력의 상대와<br />CP ±8% 밴드로 매칭됩니다</p>}
        {phase === 'searching' && (
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <span className="mono text-[12px] text-text-3">탐색 중 · 밴드 ±{Math.round(band * 100)}%</span>
            {waitSec > 4 && <span className="mono text-[11px] text-muted">고스트(기록전)로 폴백 중…</span>}
          </div>
        )}
        {(phase === 'found' || phase === 'resolving') && match && (
          <div className="w-full flex flex-col items-center gap-3 animate-reveal">
            <span className="mono text-[12px] text-muted">VS</span>
            <Card className="w-full p-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">{match.sword.name}</span>
                <span className="text-[12px] text-text-3">{match.handle}</span>
              </div>
              <span className="mono text-[13px] text-blue">CP {match.cp.toLocaleString()}</span>
            </Card>
          </div>
        )}
        {err && <p className="text-[12.5px] text-red text-center">{err}</p>}
      </div>

      {phase === 'idle' && <Button disabled={!equipped} onClick={search}>매칭 시작</Button>}
      {phase === 'searching' && <Button variant="ghost" onClick={() => { if (timer.current) clearInterval(timer.current); setPhase('idle'); }}>취소</Button>}
      {(phase === 'found' || phase === 'resolving') && <Button disabled={phase === 'resolving'} onClick={startBattle}>{phase === 'resolving' ? '입장 중…' : '전투 시작'}</Button>}
    </div>
  );
}
