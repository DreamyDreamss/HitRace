import { useNavigate } from 'react-router-dom';
import { BladeSvg } from '../ui/BladeSvg';
import { Button } from '../ui/kit';

export function Onboarding() {
  const nav = useNavigate();
  return (
    <div className="min-h-[100dvh] flex flex-col gap-5 px-5 pt-6 pb-6">
      <div className="flex gap-1.5 pt-1">
        <span className="h-[3px] flex-1 rounded bg-gold" />
        <span className="h-[3px] flex-1 rounded bg-gold" />
        <span className="h-[3px] flex-1 rounded bg-surface-4" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-7 text-center">
        <BladeSvg shape={{ style: 'curved', centerline: [], trueDoubleEdge: false }} rarity="LEGEND" width={150} height={230} glow />
        <div className="flex flex-col gap-2.5 px-2">
          <h2 className="text-[25px] font-bold leading-snug tracking-tight">오늘 달린 길이<br />당신의 첫 검이 됩니다</h2>
          <p className="text-[14px] text-text-3 leading-relaxed">1km만 달려보세요. 경로의 모양 그대로,<br />페이스와 언덕이 능력치가 됩니다.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <PermCard title="위치 권한" desc="경로 기록에 필요 · 러닝 중에만" state="필요" />
        <PermCard title="신체 활동" desc="케이던스 → 내구도 계산" state="선택" />
        <Button onClick={() => nav('/run')}>첫 러닝 시작하기</Button>
      </div>
    </div>
  );
}

function PermCard({ title, desc, state }: { title: string; desc: string; state: string }) {
  return (
    <div className="bg-surface-2 border border-hair rounded-[14px] px-4 py-3.5 flex justify-between items-center">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="text-[12px] text-muted">{desc}</span>
      </div>
      <span className="text-[12px] font-semibold text-text-2 border border-hair-2 px-3.5 py-1.5 rounded-pill">{state}</span>
    </div>
  );
}
