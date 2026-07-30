import { create } from 'zustand';
import { api, getToken, setToken, type MeResponse } from '../lib/api';

interface SessionState {
  ready: boolean;
  authed: boolean;
  me?: MeResponse;
  error?: string;
  bootstrap: () => Promise<void>;
  login: (handle?: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  ready: false,
  authed: false,

  bootstrap: async () => {
    if (getToken()) {
      try {
        const me = await api.me();
        set({ authed: true, me, ready: true });
        return;
      } catch {
        setToken(null);
      }
    }
    set({ ready: true, authed: false });
  },

  login: async (handle = 'demo') => {
    const { token } = await api.login(handle);
    setToken(token);
    const me = await api.me();
    set({ authed: true, me, error: undefined });
  },

  refresh: async () => {
    if (!get().authed) return;
    try {
      const me = await api.me();
      set({ me });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  logout: () => {
    setToken(null);
    set({ authed: false, me: undefined });
  },
}));
