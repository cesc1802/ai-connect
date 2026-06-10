import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api, setOnUnauthorized } from "./api";
import { ApiError } from "./api-error";
import { clearToken, getToken, setToken } from "./auth-token";

// Owns the live token state and the login/logout actions. Registers the
// transport's 401 handler at mount so an expired session anywhere clears the
// token and redirects to /login (Approach A — transport stays React-agnostic).

interface LoginResponse {
  token: string;
  expiresIn: string;
}

interface AuthValue {
  token: string | null;
  isAuthenticated: boolean;
  submitting: boolean;
  error: ApiError | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<LoginResponse>("/auth/login", { username, password });
      setToken(res.token);
      setTokenState(res.token);
    } catch (err) {
      if (err instanceof ApiError) setError(err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      // A 401 on the login screen is bad credentials, not session expiry —
      // skip the redirect/logout so it doesn't fight the login error banner.
      // NOTE: the "/login" literal assumes the app is served at the root (no
      // router basename / Vite base sub-path). Revisit if that changes.
      if (window.location.pathname === "/login") return;
      logout();
      navigate("/login", { replace: true });
    });
    return () => setOnUnauthorized(() => {});
  }, [logout, navigate]);

  const value = useMemo<AuthValue>(
    () => ({ token, isAuthenticated: !!token, submitting, error, login, logout }),
    [token, submitting, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
