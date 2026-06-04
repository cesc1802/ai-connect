import { create } from 'zustand';
import type { SessionUser } from '@/schemas/auth';

type AuthState = {
  accessToken: string | null;
  user: SessionUser | null;
  expiresAt: number | null;
  setSession: (s: { accessToken: string; user: SessionUser; expiresInSec: number }) => void;
  setAccessToken: (token: string, expiresInSec: number) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  expiresAt: null,
  setSession: ({ accessToken, user, expiresInSec }) =>
    set({
      accessToken,
      user,
      expiresAt: Date.now() + expiresInSec * 1000,
    }),
  setAccessToken: (accessToken, expiresInSec) =>
    set({
      accessToken,
      expiresAt: Date.now() + expiresInSec * 1000,
    }),
  clear: () => set({ accessToken: null, user: null, expiresAt: null }),
}));

export const useAccessToken = () => useAuthStore((s) => s.accessToken);
export const useSessionUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.accessToken != null);
