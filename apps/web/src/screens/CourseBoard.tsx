import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useSession } from '../store/session';
import { Card, SectionTitle, Spinner } from '../ui/kit';

// Per-course rivalry — the same route is worth re-running to top its board.
export function CourseBoard() {
  const { hash } = useParams();
  const nav = useNavigate();
  const { me } = useSession();
  const { data, isLoading } = useQuery({ queryKey: ['course', hash], queryFn: () => api.courseBoard(hash!), enabled: !!hash });

  const label = decodeURIComponent(hash ?? '').startsWith('treadmill') ? '실내 코스' : (data?.[0]?.handle ? '코스 라이벌' : '코스 라이벌');
  const myId = me?.user.id;

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="text-[15px] text-muted">‹ 도감</button>
        <span className="text-[16px] font-semibold">{label}</span>
        <span className="w-8" />
      </div>

      <p className="text-[12px] text-text-3 leading-relaxed">이 코스를 달린 러너들의 최고 주조 스코어입니다. 같은 길을 더 잘 달리면 순위가 오릅니다.</p>

      {isLoading ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <div className="py-12 text-center text-text-3 text-[14px]">아직 이 코스의 기록이 없습니다.</div>
      ) : (
        <>
          <SectionTitle eyebrow="LEADERBOARD" title="주조 스코어" />
          <Card className="p-2 divide-y divide-hair">
            {data.map((r) => {
              const mine = r.userId === myId;
              return (
                <div key={r.userId} className={`flex items-center justify-between px-2.5 py-3 ${mine ? 'bg-gold/5 -mx-2 px-4 rounded-lg' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className={`mono text-[13px] w-6 ${r.rank <= 3 ? 'text-gold' : 'text-muted'}`}>{r.rank}</span>
                    <span className={`text-[14px] ${mine ? 'text-gold-2 font-semibold' : ''}`}>{r.handle}{mine ? ' (나)' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="mono text-[13px] text-text-2">{r.bestScore}점</span>
                    <span className="mono text-[11px] text-muted">CP {r.bestCp.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}
