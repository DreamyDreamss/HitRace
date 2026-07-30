import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useSession } from '../store/session';
import { BladeSvg } from '../ui/BladeSvg';
import { Button, Card, CurrencyPill, Eyebrow, RarityChip, SectionTitle, Spinner } from '../ui/kit';
import { tierFromRp } from '@hitrace/game-core';

export function Home() {
  const nav = useNavigate();
  const { me } = useSession();
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: api.me, initialData: me });
  const ranking = useQuery({ queryKey: ['ranking'], queryFn: api.ranking });

  if (isLoading || !data) return <Spinner label="대장간 준비 중" />;
  const { user, wallet, equipped, swordCount } = data;
  const tier = tierFromRp(user.rankRp);

  // Rust patina: an idle blade dulls; a run polishes it off. Cosmetic (spec's comeback hook).
  const today = Math.floor(Date.now() / 86_400_000);
  const idleDays = user.lastRunDay != null ? Math.max(0, today - user.lastRunDay) : 0;
  const patina = Math.min(0.7, Math.max(0, (idleDays - 2) / 12));

  return (
    <div className="flex flex-col gap-5 px-5 pt-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <Eyebrow>시즌 3 · D-24</Eyebrow>
          <h1 className="text-[22px] font-semibold tracking-tight">대장간</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <CurrencyPill kind="ore" value={wallet.ore} />
          <CurrencyPill kind="forgeTicket" value={wallet.forgeTicket} />
        </div>
      </div>

      {/* Equipped hero */}
      {equipped && (
        <Card className="p-4 flex gap-4 items-center" onClick={() => nav(`/sword/${equipped.id}`)}>
          <div className="shrink-0">
            <BladeSvg shape={equipped.shape} rarity={equipped.rarity} width={72} height={168} glow={equipped.rarity === 'LEGEND' && patina < 0.15} patina={patina} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <RarityChip rarity={equipped.rarity} plus={equipped.plus} />
              {equipped.shape.trueDoubleEdge && <span className="mono text-[10px] text-gold-2">眞 양날</span>}
            </div>
            <div className="text-[17px] font-semibold truncate">{equipped.name}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {([['예리', equipped.stats.sharpness], ['중량', equipped.stats.weight], ['내구', equipped.stats.durability], ['마력', equipped.stats.magic]] as const).map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <span className="text-[10px] text-muted">{k}</span>
                  <span className="mono text-[13px] text-text-2">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Weekly / stats row */}
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="연속 러닝" value={`${user.streakDays}`} unit="일" accent />
        <Stat label="주조한 검" value={String(swordCount)} />
        <Stat label="랭크" value={tier.label} />
      </div>
      {patina >= 0.15 ? (
        <div className="flex items-center gap-2 -mt-1 px-1">
          <span className="text-[16px]">🌫️</span>
          <span className="text-[12px] text-text-3">검이 녹슬고 있습니다 · <b className="text-blue">달리면 광이 납니다</b></span>
        </div>
      ) : user.streakDays >= 2 && (
        <div className="flex items-center gap-2 -mt-1 px-1">
          <span className="text-[16px]">🔥</span>
          <span className="text-[12px] text-text-3">숫돌 연마 <b className="text-gold-2">+{Math.min(7, user.streakDays)}%</b> 강화 성공률 · 오늘도 달리면 이어집니다</span>
        </div>
      )}

      {/* Daily quest */}
      <div className="flex flex-col gap-2.5">
        <SectionTitle eyebrow="TODAY" title="오늘의 주조 의뢰" />
        <Card className="p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[13.5px] font-medium">평균 페이스 5'30" 이하로 5km</span>
            <span className="text-[12px] text-text-3">예리함 보너스 ×1.2</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="mono text-[12px] text-gold-2">+300</span>
            <CurrencyPill kind="ore" value={300} />
          </div>
        </Card>
      </div>

      {/* Mini leaderboard */}
      {ranking.data && (
        <div className="flex flex-col gap-2.5">
          <SectionTitle eyebrow="RANKING" title="코스 라이벌" right={<Link to="/ranking" className="text-[12px] text-blue">전체</Link>} />
          <Card className="p-2 divide-y divide-hair">
            {ranking.data.slice(0, 3).map((r) => (
              <div key={r.rank} className="flex items-center justify-between px-2 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="mono text-[12px] text-muted w-5">{r.rank}</span>
                  <span className="text-[13.5px]">{r.handle}</span>
                </div>
                <span className="mono text-[12px] text-text-3">CP {r.cp.toLocaleString()}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* CTA */}
      <Button className="w-full" onClick={() => nav('/run')}>러닝 시작</Button>
    </div>
  );
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <Card className="p-3 flex flex-col gap-1">
      <span className="text-[11px] text-muted">{label}</span>
      <span className={`mono text-[18px] font-semibold ${accent ? 'text-gold' : 'text-text'}`}>
        {value}{unit && <span className="text-[10px] text-muted ml-0.5">{unit}</span>}
      </span>
    </Card>
  );
}
