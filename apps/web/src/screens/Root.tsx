import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useSession } from '../store/session';
import { useOfflineSync } from '../lib/offlineQueue';
import { Button, Spinner } from '../ui/kit';
import { BladeSvg } from '../ui/BladeSvg';

export function Root() {
  const { ready, authed, bootstrap } = useSession();
  useEffect(() => { void bootstrap(); }, [bootstrap]);
  useOfflineSync();

  if (!ready) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-bg">
        <Spinner label="불러오는 중" />
      </div>
    );
  }
  if (!authed) return <LoginGate />;
  return <Outlet />;
}

function LoginGate() {
  const { login, error } = useSession();
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-8 bg-bg px-8 text-center">
      <BladeSvg shape={{ style: 'double_edge', centerline: [], trueDoubleEdge: true }} rarity="LEGEND" width={120} height={280} glow />
      <div className="flex flex-col gap-2">
        <div className="eyebrow">RUN → BLADE</div>
        <h1 className="text-[28px] font-bold leading-tight">달린 경로가<br />검이 된다</h1>
        <p className="text-[14px] text-text-3 leading-relaxed">러닝 기록을 무기로 주조하고, 광석으로 강화해<br />자동전투로 겨루는 러닝 RPG.</p>
      </div>
      <div className="w-full max-w-[320px] flex flex-col gap-3">
        <Button onClick={() => void login('demo')}>데모로 시작하기</Button>
        {error && <span className="text-[12px] text-red">{error}</span>}
        <span className="text-[11px] text-muted">개발 모드 · demo 계정으로 즉시 플레이</span>
      </div>
    </div>
  );
}
