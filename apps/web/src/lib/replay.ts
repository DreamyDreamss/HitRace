// Shareable deterministic replays. Combat is a pure function of (a, b, seed), so a
// match compresses to a tiny URL that replays the exact fight for anyone — no server.

import type { Stats } from '@hitrace/game-core';

export interface ReplayPayload {
  seed: string;
  a: { name: string; stats: Stats; cadence: number };
  b: { name: string; stats: Stats; cadence: number };
}

// base64url encode/decode (URL-safe, no padding).
function b64urlEncode(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)));
}

export function encodeReplay(p: ReplayPayload): string {
  return b64urlEncode(JSON.stringify(p));
}

export function decodeReplay(data: string): ReplayPayload | null {
  try {
    const p = JSON.parse(b64urlDecode(data));
    if (!p?.seed || !p?.a?.stats || !p?.b?.stats) return null;
    return p as ReplayPayload;
  } catch {
    return null;
  }
}

export function replayUrl(p: ReplayPayload): string {
  return `${location.origin}/replay/${encodeReplay(p)}`;
}
