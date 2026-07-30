import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { BladeSvg } from '../ui/BladeSvg';
import { Card, SectionTitle, Spinner } from '../ui/kit';
import { RARITY_COLOR } from '../ui/rarity';

// 명검 도감 — every course ever forged, kept forever (even after dismantling the sword).
export function Codex() {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['codex'], queryFn: api.codex });
  if (isLoading || !data) return <Spinner label="도감 여는 중" />;

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="text-[15px] text-muted">‹ 프로필</button>
        <span className="text-[16px] font-semibold">명검 도감</span>
        <span className="mono text-[12px] text-gold-2">{data.totals.courses}코스</span>
      </div>

      <p className="text-[12px] text-text-3 leading-relaxed">
        달려서 검으로 주조한 모든 코스가 이곳에 영원히 남습니다. 검을 분해해도 그날의 길은 사라지지 않습니다.
      </p>

      {data.entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-text-3 text-[14px]">아직 기록된 코스가 없습니다.</p>
          <button onClick={() => nav('/run')} className="text-blue text-[13px]">첫 코스를 달려보세요 →</button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {data.entries.map((e) => (
            <Card key={e.courseHash} onClick={() => nav(`/course/${encodeURIComponent(e.courseHash)}`)} className="p-2.5 flex flex-col items-center gap-1.5">
              <BladeSvg shape={e.shape} rarity={e.bestRarity} width={40} height={96} glow={e.bestRarity === 'LEGEND'} />
              <span className="text-[11px] font-medium text-center truncate w-full">{e.name}</span>
              <div className="flex items-center gap-1">
                <span className="mono text-[9px] px-1.5 py-0.5 rounded" style={{ color: RARITY_COLOR[e.bestRarity], background: `${RARITY_COLOR[e.bestRarity]}22` }}>{e.bestRarity}</span>
                {e.timesForged > 1 && <span className="mono text-[9px] text-muted">×{e.timesForged}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
