import { apiFetch } from './client';
import {
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RefreshResponse,
} from '@/schemas/auth';

export async function login(input: LoginRequest): Promise<LoginResponse> {
  const body = LoginRequest.parse(input);
  return apiFetch(
    '/auth/login',
    { method: 'POST', body, skipAuth: true },
    LoginResponse,
  );
}

export async function refresh(): Promise<RefreshResponse> {
  return apiFetch(
    '/auth/refresh',
    { method: 'POST', skipAuth: true, skipRefresh: true },
    RefreshResponse,
  );
}

export async function logout(): Promise<LogoutResponse> {
  return apiFetch('/auth/logout', { method: 'POST' }, LogoutResponse);
}
