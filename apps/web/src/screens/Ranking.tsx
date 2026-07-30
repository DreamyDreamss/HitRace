import { useQuery } from '@tanstack/react-query';
import { TIERS, tierFromRp } from '@hitrace/game-core';
import { api } from '../lib/api';
import { useSession } from '../store/session';
import { Card, SectionTitle, Spinner } from '../ui/kit';

export function Ranking() {
  const { me } = useSession();
  const { data, isLoading } = useQuery({ queryKey: ['ranking'], queryFn: api.ranking });
  const myRp = me?.user.rankRp ?? 0;
  const myTier = tierFromRp(myRp);

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
      <SectionTitle eyebrow="SEASON 3" title="랭킹" />

      {/* my tier */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-muted">내 티어</span>
          <span className="text-[20px] font-bold text-gold">{myTier.tier} · {myTier.label}</span>
        </div>
        <span className="mono text-[14px] text-text-2">{myRp.toLocaleString()} RP</span>
      </Card>

      {/* tier ladder */}
      <div className="flex items-center justify-between gap-1">
        {TIERS.map((t) => {
          const active = t === myTier.tier;
          return (
            <div key={t} className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`w-full h-1.5 rounded-full ${active ? 'bg-gold' : 'bg-surface-4'}`} />
              <span className={`text-[9.5px] ${active ? 'text-gold' : 'text-muted'}`}>{t}</span>
            </div>
          );
        })}
      </div>

      <SectionTitle eyebrow="LEADERBOARD" title="상위 러너" />
      {isLoading ? (
        <Spinner />
      ) : (
        <Card className="p-2 divide-y divide-hair">
          {(data ?? []).map((r) => (
            <div key={r.rank} className="flex items-center justify-between px-2 py-3">
              <div className="flex items-center gap-3">
                <span className={`mono text-[13px] w-6 ${r.rank <= 3 ? 'text-gold' : 'text-muted'}`}>{r.rank}</span>
                <span className="text-[14px]">{r.handle}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="mono text-[12px] text-text-3">CP {r.cp.toLocaleString()}</span>
                <span className="mono text-[12px] text-blue">{r.rankRp} RP</span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
