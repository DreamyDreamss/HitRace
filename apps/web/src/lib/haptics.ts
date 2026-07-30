// Thin wrapper over the Vibration API. No-ops where unsupported (desktop, iOS Safari).
// Respects prefers-reduced-motion.

function reduced(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function vibe(pattern: number | number[]) {
  if (reduced()) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

export const haptics = {
  tap: () => vibe(8),
  success: () => vibe([12, 40, 24]),
  fail: () => vibe([30, 30, 30]),
  hit: () => vibe(10),
  forge: () => vibe([16, 30, 16, 30, 40]),
};
