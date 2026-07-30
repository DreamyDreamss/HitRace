import type { ReactNode } from 'react';
import type { Rarity, Stats } from '@hitrace/game-core';
import { haptics } from '../lib/haptics';
import { CURRENCY_META, RARITY_COLOR, STAT_META } from './rarity';

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface-2 border border-hair rounded-[14px] ${onClick ? 'pressable cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children, onClick, variant = 'primary', disabled, className = '', type = 'button',
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; className?: string; type?: 'button' | 'submit';
}) {
  const styles =
    variant === 'primary'
      ? 'bg-gold text-[#0B0C0E] font-bold'
      : variant === 'danger'
        ? 'bg-transparent border border-red/50 text-red font-semibold'
        : 'bg-transparent border border-hair-2 text-text-2 font-semibold';
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick ? () => { haptics.tap(); onClick(); } : undefined}
      className={`pressable h-[54px] rounded-2xl flex items-center justify-center text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${styles} ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

export function RarityChip({ rarity, plus }: { rarity: Rarity; plus?: number }) {
  const c = RARITY_COLOR[rarity];
  return (
    <span className="mono text-[11px] px-2 py-[3px] rounded-md" style={{ color: c, background: `${c}22`, border: `1px solid ${c}55` }}>
      {rarity}{plus ? ` · +${plus}` : ''}
    </span>
  );
}

export function CurrencyPill({ kind, value }: { kind: keyof typeof CURRENCY_META; value: number }) {
  const meta = CURRENCY_META[kind];
  return (
    <div className="flex items-center gap-1.5 bg-surface-3 border border-hair rounded-pill px-2.5 py-1">
      <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
      <span className="mono text-[12px] text-text-2">{value.toLocaleString()}</span>
    </div>
  );
}

export function StatBars({ stats, max = 900 }: { stats: Stats; max?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {STAT_META.map((s) => {
        const v = stats[s.key];
        return (
          <div key={s.key} className="flex items-center gap-3">
            <span className="text-[12px] text-text-3 w-10 shrink-0">{s.ko}</span>
            <div className="flex-1 h-[6px] rounded-full bg-surface-4 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: s.color }} />
            </div>
            <span className="mono text-[12px] text-text-2 w-10 text-right">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between">
      <div className="flex flex-col gap-0.5">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="text-[17px] font-semibold text-text">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <div className="w-6 h-6 rounded-full border-2 border-surface-4 border-t-gold animate-spin" />
      {label && <span className="text-[13px]">{label}</span>}
    </div>
  );
}
