// Run tracker hook. Uses the real Geolocation API (watchPosition) on mobile; also
// offers a deterministic simulation so the app is testable on desktop with no GPS.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GpsPoint } from '@hitrace/game-core';
import { pathLengthMeters } from '@hitrace/game-core';

export type RunStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface RunState {
  status: RunStatus;
  points: GpsPoint[];
  distanceKm: number;
  durationSec: number;
  paceSecPerKm: number;
  gpsOk: boolean;
  simulated: boolean;
}

const SEOUL = { lat: 37.5285, lng: 126.9327 };

export function useRunTracker() {
  const [state, setState] = useState<RunState>({
    status: 'idle', points: [], distanceKm: 0, durationSec: 0, paceSecPerKm: 0, gpsOk: false, simulated: false,
  });
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTs = useRef<number>(0);
  const pausedMs = useRef<number>(0);
  const pauseStart = useRef<number>(0);
  const pointsRef = useRef<GpsPoint[]>([]);

  const recompute = useCallback(() => {
    const pts = pointsRef.current;
    const distanceM = pathLengthMeters(pts);
    const distanceKm = distanceM / 1000;
    const durationSec = pts.length ? (Date.now() - startTs.current - pausedMs.current) / 1000 : 0;
    const paceSecPerKm = distanceKm > 0.02 ? durationSec / distanceKm : 0;
    setState((s) => ({ ...s, points: [...pts], distanceKm, durationSec, paceSecPerKm }));
  }, []);

  const addPoint = useCallback((p: GpsPoint) => {
    pointsRef.current.push(p);
    recompute();
  }, [recompute]);

  const start = useCallback(() => {
    pointsRef.current = [];
    pausedMs.current = 0;
    startTs.current = Date.now();
    setState((s) => ({ ...s, status: 'running', simulated: false, points: [], distanceKm: 0, durationSec: 0, paceSecPerKm: 0 }));

    if ('geolocation' in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          setState((s) => ({ ...s, gpsOk: true }));
          addPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, ele: pos.coords.altitude ?? undefined, t: Date.now() });
        },
        () => setState((s) => ({ ...s, gpsOk: false })),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 },
      );
    }
  }, [addPoint]);

  // Deterministic simulated run (a curvy Seoul course), sped up for testing.
  const simulate = useCallback(() => {
    pointsRef.current = [];
    pausedMs.current = 0;
    startTs.current = Date.now();
    setState((s) => ({ ...s, status: 'running', simulated: true, gpsOk: true, points: [], distanceKm: 0, durationSec: 0, paceSecPerKm: 0 }));
    let i = 0;
    const N = 160;
    const cos0 = Math.cos((SEOUL.lat * Math.PI) / 180);
    simTimer.current = setInterval(() => {
      const f = i / (N - 1);
      const spanM = 6000; // ~6km
      const dx = f * spanM;
      const dy = Math.sin(f * Math.PI * 5) * 140;
      addPoint({
        lat: SEOUL.lat + dy / 111320,
        lng: SEOUL.lng + dx / (111320 * cos0),
        ele: 20 + Math.sin(f * Math.PI) * 55,
        t: startTs.current + Math.round(f * 6000 * 300), // compress ~30min into the timeline
      });
      i++;
      if (i >= N) {
        if (simTimer.current) clearInterval(simTimer.current);
        setState((s) => ({ ...s, status: 'finished' }));
      }
    }, 40);
  }, [addPoint]);

  const pause = useCallback(() => {
    pauseStart.current = Date.now();
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (simTimer.current) clearInterval(simTimer.current);
    setState((s) => ({ ...s, status: 'paused' }));
  }, []);

  const stop = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (simTimer.current) clearInterval(simTimer.current);
    recompute();
    setState((s) => ({ ...s, status: 'finished' }));
  }, [recompute]);

  // tick the duration while running
  useEffect(() => {
    if (state.status !== 'running') return;
    const t = setInterval(recompute, 1000);
    return () => clearInterval(t);
  }, [state.status, recompute]);

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (simTimer.current) clearInterval(simTimer.current);
  }, []);

  return { ...state, start, simulate, pause, stop };
}
