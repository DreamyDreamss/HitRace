import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card, CurrencyPill, SectionTitle, Spinner } from '../ui/kit';

const KIND_KO: Record<string, string> = { ore: '철광석', forgeTicket: '티켓', engraveStone: '각인석', skin: '스킨' };

export function Season() {
  const { data, isLoading } = useQuery({ queryKey: ['season'], queryFn: api.season });
  if (isLoading || !data) return <Spinner label="시즌 불러오는 중" />;

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
      <SectionTitle eyebrow={`D-${data.season.daysLeft}`} title={data.season.name} />

      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-text-3">패스 레벨</span>
          <span className="mono text-[18px] font-bold text-gold">Lv.{data.pass.level}</span>
        </div>
        <div className="h-[6px] rounded-full bg-surface-4 overflow-hidden">
          <div className="h-full bg-gold rounded-full" style={{ width: `${data.progress.pct * 100}%` }} />
        </div>
        <span className="mono text-[11px] text-muted">
          다음 레벨까지 {(data.progress.perLevel - data.progress.intoLevel).toFixed(1)}km · 러닝 {data.pass.kmProgress.toFixed(1)}km 누적
        </span>
      </Card>

      {/* Purchase premium */}
      {!data.pass.isPremium && (
        <div className="bg-gold/10 border border-gold/35 rounded-[14px] px-4 py-3.5 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-gold-2">프리미엄 패스</span>
            <span className="text-[12px] text-text-3">스킨 · 칭호 · 티켓 · 스탯 없음</span>
          </div>
          <span className="mono text-[14px] text-gold">₩5,900</span>
        </div>
      )}

      {/* Reward track */}
      <div className="flex flex-col gap-2">
        <div className="flex text-[11px] text-muted px-1">
          <span className="w-12">레벨</span>
          <span className="flex-1">무료</span>
          <span className="flex-1">프리미엄</span>
        </div>
        <Card className="divide-y divide-hair max-h-[46vh] overflow-y-auto no-scrollbar">
          {data.rewards.map((r) => (
            <div key={r.level} className={`flex items-center px-3 py-2.5 ${r.claimed ? 'opacity-100' : 'opacity-55'}`}>
              <span className={`w-12 mono text-[13px] ${r.claimed ? 'text-gold' : 'text-muted'}`}>{r.level}</span>
              <div className="flex-1"><Reward kind={r.free.kind} amount={r.free.amount} claimed={r.claimed} /></div>
              <div className="flex-1"><Reward kind={r.premium.kind} amount={r.premium.amount} claimed={r.claimed && data.pass.isPremium} locked={!data.pass.isPremium} /></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function Reward({ kind, amount, claimed, locked }: { kind: string; amount: number; claimed?: boolean; locked?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[12px] ${locked ? 'text-muted' : 'text-text-2'}`}>{KIND_KO[kind] ?? kind} ×{amount}</span>
      {claimed && <span className="text-[10px] text-gold">✓</span>}
      {locked && <span className="text-[10px] text-muted">🔒</span>}
    </div>
  );
}
