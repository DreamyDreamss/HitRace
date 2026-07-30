import type { BladeShape, Rarity } from '@hitrace/game-core';
import { RARITY_COLOR } from './rarity';

// Draws a sword. If the shape carries a GPS-derived centerline we trace it as the
// blade's "grain"; otherwise we fall back to a stylised silhouette per blade style.
export function BladeSvg({
  shape, rarity, width = 120, height = 300, glow = false, patina = 0,
}: {
  shape: Pick<BladeShape, 'style' | 'centerline' | 'trueDoubleEdge' | 'transform'>;
  rarity: Rarity; width?: number; height?: number; glow?: boolean;
  /** 0..1 rust from being idle — polishes off with a run. Cosmetic only. */
  patina?: number;
}) {
  const c = RARITY_COLOR[rarity];
  const hasPath = shape.centerline && shape.centerline.length > 3;

  // Map normalized centerline (0..1) into the blade region.
  const bladeTop = 24, bladeBottom = height - 70, cx = width / 2, bladeW = width * 0.34;
  const grain = hasPath
    ? shape.centerline
        .map((p, i) => {
          const x = cx + (p.x - 0.5) * bladeW;
          const y = bladeTop + p.y * (bladeBottom - bladeTop);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ')
    : defaultGrain(shape.style, cx, bladeTop, bladeBottom, bladeW);

  const silhouette = bladeSilhouette(shape.style, cx, bladeTop, bladeBottom, bladeW, shape.trueDoubleEdge);

  // Cosmetic-only transform from the forge workshop.
  const t = shape.transform;
  const sx = (t?.flipH ? -1 : 1) * (t?.scale ?? 1);
  const sy = (t?.flipV ? -1 : 1) * (t?.scale ?? 1);
  const tf = t ? `rotate(${t.rotate} ${cx} ${height / 2}) translate(${cx} ${height / 2}) scale(${sx} ${sy}) translate(${-cx} ${-height / 2})` : undefined;

  const patinaStyle = patina > 0.02 ? { filter: `saturate(${(1 - patina * 0.7).toFixed(2)}) brightness(${(1 - patina * 0.28).toFixed(2)})` } : undefined;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-label="검" style={patinaStyle}>
      <defs>
        <linearGradient id={`bl-${rarity}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE9B0" />
          <stop offset=".55" stopColor={c} />
          <stop offset="1" stopColor="#8B6314" />
        </linearGradient>
        {glow && (
          <filter id="g" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        )}
      </defs>
      {t?.mirror && (
        <g transform={`translate(${width} 0) scale(-1 1)`} opacity="0.5">
          <path d={silhouette} fill={`url(#bl-${rarity})`} stroke={c} strokeWidth="1" />
        </g>
      )}
      <g filter={glow ? 'url(#g)' : undefined} transform={tf}>
        {/* blade body */}
        <path d={silhouette} fill={`url(#bl-${rarity})`} opacity="0.92" stroke={c} strokeWidth="1" />
        {/* grain (the run's trace) */}
        <path d={grain} fill="none" stroke="#FFE9B0" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
        {/* guard */}
        <rect x={cx - bladeW * 1.15} y={bladeBottom} width={bladeW * 2.3} height="10" rx="5" fill="#8FA6C4" />
        {/* handle */}
        <rect x={cx - 7} y={bladeBottom + 10} width="14" height="46" rx="7" fill="#282C34" />
        <circle cx={cx} cy={bladeBottom + 62} r="8" fill="#4A5260" />
        <circle cx={cx} cy={bladeTop} r="5" fill="#FFE9B0" />
      </g>
      {patina > 0.15 && (
        <g opacity={Math.min(0.55, patina)} aria-hidden="true">
          {[0.2, 0.38, 0.55, 0.72].map((f, i) => (
            <circle key={i} cx={cx + (i % 2 ? bladeW * 0.28 : -bladeW * 0.22)} cy={bladeTop + f * (bladeBottom - bladeTop)} r={2.4 + (i % 3)} fill="#6B4A2A" />
          ))}
        </g>
      )}
    </svg>
  );
}

function bladeSilhouette(style: string, cx: number, top: number, bottom: number, w: number, doubleEdge: boolean): string {
  const midY = (top + bottom) / 2;
  if (style === 'chakram') {
    const r = (bottom - top) / 2.4;
    return `M ${cx} ${top} A ${r} ${r} 0 1 1 ${cx - 0.1} ${top}`; // ring-ish
  }
  if (style === 'curved') {
    return `M ${cx} ${top} C ${cx + w} ${midY - 30}, ${cx + w * 0.6} ${midY + 40}, ${cx + w * 0.2} ${bottom}
            L ${cx - w * 0.5} ${bottom} C ${cx - w * 0.2} ${midY}, ${cx - w * 0.4} ${midY - 20}, ${cx} ${top} Z`;
  }
  // straight / double_edge — symmetric leaf
  const edge = doubleEdge ? w * 1.05 : w;
  return `M ${cx} ${top}
          L ${cx + edge} ${top + 60}
          L ${cx + edge * 0.55} ${bottom}
          L ${cx - edge * 0.55} ${bottom}
          L ${cx - edge} ${top + 60} Z`;
}

function defaultGrain(style: string, cx: number, top: number, bottom: number, w: number): string {
  if (style === 'curved') return `M ${cx} ${top} C ${cx + w * 0.4} ${(top + bottom) / 2}, ${cx - w * 0.2} ${(top + bottom) / 2 + 30}, ${cx + w * 0.1} ${bottom}`;
  return `M ${cx} ${top} C ${cx + 8} ${(top + bottom) * 0.4}, ${cx - 8} ${(top + bottom) * 0.6}, ${cx} ${bottom}`;
}
