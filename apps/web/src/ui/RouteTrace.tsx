import type { GpsPoint } from '@hitrace/game-core';
import { normalize, toLocalXY } from '@hitrace/game-core';

// Draws the GPS path (normalized) as the runner's glowing trace.
export function RouteTrace({ points, className = '', height = 200 }: { points: GpsPoint[]; className?: string; height?: number }) {
  const W = 372, H = height, pad = 24;
  const xy = points.length > 1 ? normalize(toLocalXY(points)) : [];
  const d = xy
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(pad + p.x * (W - 2 * pad)).toFixed(1)} ${(H - pad - p.y * (H - 2 * pad)).toFixed(1)}`)
    .join(' ');
  const last = xy[xy.length - 1];
  const first = xy[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} width="100%" height={H} preserveAspectRatio="xMidYMid meet">
      <rect width={W} height={H} fill="#0E1014" />
      <g stroke="#171A20" strokeWidth="1">
        {[0.25, 0.5, 0.75].map((f) => <path key={'h' + f} d={`M0 ${H * f} H${W}`} />)}
        {[0.2, 0.4, 0.6, 0.8].map((f) => <path key={'v' + f} d={`M${W * f} 0 V${H}`} />)}
      </g>
      {d && <path d={d} fill="none" stroke="#D9A227" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
      {first && <circle cx={pad + first.x * (W - 2 * pad)} cy={H - pad - first.y * (H - 2 * pad)} r="6" fill="#5E656F" />}
      {last && <circle cx={pad + last.x * (W - 2 * pad)} cy={H - pad - last.y * (H - 2 * pad)} r="7" fill="#D9A227" />}
    </svg>
  );
}
