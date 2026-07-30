import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../store/session';
import { usePvp } from '../store/pvp';
import { haptics } from '../lib/haptics';
import { replayUrl } from '../lib/replay';
import { toast } from '../store/toast';
import { Button } from '../ui/kit';
import { CombatStage } from '../ui/CombatStage';

export function Battle() {
  const nav = useNavigate();
  const { result, myName } = usePvp();
  const { refresh } = useSession();
  const [done, setDone] = useState(false);

  if (!result) {
    return (
      <div className="min-h-[60dvh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-text-3 text-[14px]">진행 중인 전투가 없습니다.</p>
        <Button variant="ghost" onClick={() => nav('/pvp')}>매칭하러 가기</Button>
      </div>
    );
  }

  const finish = () => {
    setDone(true);
    void refresh();
    result.won ? haptics.success() : haptics.fail();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col gap-4 px-5 pt-5 pb-6">
      <CombatStage combat={result.combat} aName={myName ?? '내 검'} bName={result.opponent.sword.name} onDone={finish} />
      {done && <ResultPanel />}
    </div>
  );
}

function ResultPanel() {
  const nav = useNavigate();
  const { result, clear } = usePvp();
  if (!result) return null;
  const won = result.won;

  const share = async () => {
    const url = replayUrl(result.replay);
    try {
      if (navigator.share) await navigator.share({ title: 'HitRace 전투 리플레이', url });
      else { await navigator.clipboard.writeText(url); toast.success('리플레이 링크를 복사했어요'); }
    } catch { /* user cancelled */ }
  };

  return (
    <div className="flex flex-col gap-3 animate-reveal">
      <div className="text-center flex flex-col gap-1">
        <span className={`text-[24px] font-bold ${won ? 'text-gold' : 'text-text-3'}`}>{won ? '승리' : '패배'}</span>
        <span className={`mono text-[15px] ${won ? 'text-gold-2' : 'text-red'}`}>{result.rpDelta > 0 ? `+${result.rpDelta}` : result.rpDelta} RP · 현재 {result.rankRp}</span>
      </div>
      <div className="flex gap-2.5">
        <Button variant="ghost" className="flex-1" onClick={share}>리플레이 공유</Button>
        <Button variant="ghost" className="flex-1" onClick={() => { clear(); nav('/pvp'); }}>다시</Button>
        <Button className="flex-[1.2]" onClick={() => { clear(); nav('/'); }}>확인</Button>
      </div>
    </div>
  );
}
