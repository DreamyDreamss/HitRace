// Offline-first run recording. Runners lose signal mid-run; if a forge/record
// submit fails on the network, we persist the track locally and sync when back
// online. Server remains authoritative — queued runs are recorded (not force-forged)
// so rewards/anti-cheat still run server-side on sync.

import { useEffect, useState } from 'react';
import { api } from './api';
import { toast } from '../store/toast';

const KEY = 'rb_run_queue';

interface QueuedRun {
  id: string;
  track: unknown;
  queuedAt: number;
}

function read(): QueuedRun[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function write(q: QueuedRun[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function enqueueRun(track: unknown): void {
  const q = read();
  q.push({ id: `q_${Date.now()}`, track, queuedAt: Date.now() });
  write(q);
}

export function pendingCount(): number {
  return read().length;
}

/** Is this a network-layer failure (offline), vs a server rejection? */
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError; // fetch throws TypeError when the network is unreachable
}

let flushing = false;
export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let synced = 0;
  try {
    let q = read();
    for (const item of [...q]) {
      try {
        await api.submitRun(item.track, false); // record (rewards + anti-cheat server-side)
        q = read().filter((x) => x.id !== item.id);
        write(q);
        synced++;
      } catch (e) {
        if (isNetworkError(e)) break; // still offline; stop, keep the rest
        // Server rejected (e.g. anti-cheat) — drop it so it doesn't wedge the queue.
        q = read().filter((x) => x.id !== item.id);
        write(q);
      }
    }
  } finally {
    flushing = false;
  }
  if (synced > 0) toast.success(`오프라인 러닝 ${synced}건 동기화 완료`);
  return synced;
}

/** Mount once (in Root) to auto-sync on load and whenever connectivity returns. */
export function useOfflineSync(): number {
  const [pending, setPending] = useState(pendingCount());
  useEffect(() => {
    const sync = async () => { await flushQueue(); setPending(pendingCount()); };
    void sync();
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    const iv = setInterval(() => setPending(pendingCount()), 4000);
    return () => { window.removeEventListener('online', onOnline); clearInterval(iv); };
  }, []);
  return pending;
}
