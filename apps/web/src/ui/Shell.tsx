import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useT } from '../i18n';

// A phone-framed container on desktop; edge-to-edge on real mobile. Mirrors the
// spec's 428×908 Android device shell but responsive.
export function DeviceShell({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className="min-h-full w-full flex items-stretch justify-center bg-bg">
      <div className="relative w-full max-w-[440px] bg-screen flex flex-col shadow-[0_30px_80px_rgba(0,0,0,0.5)] sm:my-4 sm:rounded-[28px] sm:overflow-hidden sm:border sm:border-hair min-h-[100dvh] sm:min-h-[900px]">
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">{children}</div>
        {nav && <BottomNav />}
      </div>
    </div>
  );
}

const NAV = [
  { to: '/', key: 'nav.home', icon: 'home' },
  { to: '/run', key: 'nav.run', icon: 'run' },
  { to: '/collection', key: 'nav.collection', icon: 'coll' },
  { to: '/pvp', key: 'nav.pvp', icon: 'pvp' },
  { to: '/gacha', key: 'nav.shop', icon: 'shop' },
] as const;

function BottomNav() {
  const loc = useLocation();
  const t = useT();
  return (
    <nav aria-label="주요 메뉴" className="shrink-0 border-t border-hair bg-screen/95 backdrop-blur px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around h-[62px]">
        {NAV.map((n) => {
          const active = n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to);
          const label = t(n.key);
          return (
            <NavLink key={n.to} to={n.to} aria-label={label} aria-current={active ? 'page' : undefined}
                     className="flex-1 flex flex-col items-center justify-center gap-1 pressable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded-lg">
              <NavIcon kind={n.icon} active={active} />
              <span className={`text-[10.5px] ${active ? 'text-gold' : 'text-muted'}`}>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({ kind, active }: { kind: string; active: boolean }) {
  const c = active ? '#D9A227' : '#5E656F';
  const common = { fill: 'none', stroke: c, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      {kind === 'home' && <path d="M4 11 L12 4 L20 11 M6 10 V20 H18 V10" {...common} />}
      {kind === 'run' && <path d="M13 4a1.6 1.6 0 100 .01M9 21l2-5 3-2 1 4 3 1M6 12l3-3 3 1 2 3" {...common} />}
      {kind === 'coll' && <path d="M12 3 L14 9 L13 20 L12 21 L11 20 L10 9 Z M7 20 H17" {...common} />}
      {kind === 'pvp' && <path d="M5 5 L14 14 M14 5 L5 14 M16 16 L20 20 M4 16 L8 20" {...common} />}
      {kind === 'shop' && <path d="M5 8 H19 L18 20 H6 Z M8 8 V6 A4 4 0 0116 6 V8" {...common} />}
    </svg>
  );
}
