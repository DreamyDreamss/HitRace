import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { tierFromRp } from '@hitrace/game-core';
import { api } from '../lib/api';
import { useLocale } from '../i18n';
import { useSession } from '../store/session';
import { Button, Card, SectionTitle, Spinner } from '../ui/kit';
import { RARITY_COLOR } from '../ui/rarity';

export function Profile() {
  const nav = useNavigate();
  const { logout } = useSession();
  const { locale, setLocale } = useLocale();
  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: api.profile });
  if (isLoading || !data) return <Spinner label="프로필" />;
  const tier = tierFromRp(data.user.rankRp);
  const { totals } = data;

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
      <SectionTitle eyebrow="RUNNER" title={data.user.handle} />

      <div className="grid grid-cols-2 gap-2.5">
        <Big label="티어" value={tier.label} accent />
        <Big label="랭크 포인트" value={`${data.user.rankRp}`} />
        <Big label="누적 러닝" value={`${totals.totalKm}`} unit="km" />
        <Big label="주조한 검" value={`${totals.swords}`} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="eyebrow">COLLECTION</span>
        <Card className="p-4 flex items-center justify-around">
          {(['LEGEND', 'SR', 'R', 'N'] as const).map((r) => (
            <div key={r} className="flex flex-col items-center gap-1">
              <span className="mono text-[18px] font-bold" style={{ color: RARITY_COLOR[r] }}>{totals.byRarity[r] ?? 0}</span>
              <span className="text-[11px] text-muted">{r}</span>
            </div>
          ))}
        </Card>
        <Card className="p-4 flex items-center justify-between pressable" onClick={() => nav('/codex')}>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold">명검 도감</span>
            <span className="text-[12px] text-text-3">달린 모든 코스의 기록 — 분해해도 남습니다</span>
          </div>
          <span className="text-[18px] text-muted">›</span>
        </Card>
      </div>

      <Card className="p-4 flex items-center justify-between">
        <span className="text-[13px] text-text-3">최고 CP</span>
        <span className="mono text-[16px] font-semibold text-gold">{totals.bestCp.toLocaleString()}</span>
      </Card>

      <div className="flex flex-col gap-2 mt-2">
        <span className="eyebrow">SETTINGS</span>
        <Card className="divide-y divide-hair">
          <Row label="러너 프로필" value={data.user.handle} />
          <Row label="최대 심박" value={`${data.user.maxHeartRate} bpm`} />
          <Row label="총 러닝 횟수" value={`${totals.runCount}회`} />
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] text-text-3">언어 · Language</span>
            <div className="flex gap-1.5">
              {(['ko', 'en'] as const).map((l) => (
                <button key={l} onClick={() => setLocale(l)}
                        className={`px-3 py-1 rounded-pill text-[12px] border ${locale === l ? 'border-gold-2 text-gold-2' : 'border-hair text-muted'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Button variant="ghost" className="mt-2" onClick={logout}>로그아웃</Button>
    </div>
  );
}

function Big({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <Card className="p-3.5 flex flex-col gap-1">
      <span className="text-[11px] text-muted">{label}</span>
      <span className={`mono text-[20px] font-semibold ${accent ? 'text-gold' : 'text-text'}`}>{value}{unit && <span className="text-[11px] text-muted ml-0.5">{unit}</span>}</span>
    </Card>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[13px] text-text-3">{label}</span>
      <span className="text-[13px] text-text-2">{value}</span>
    </div>
  );
}
