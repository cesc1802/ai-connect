import { useMutation } from '@tanstack/react-query';
import { login } from '@/api/auth';
import { useAuthStore } from '@/stores/auth-store';
import type { LoginRequest, LoginResponse } from '@/schemas/auth';

export function useLogin() {
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: (input) => login(input),
    onSuccess: (res) => {
      useAuthStore.getState().setSession({
        accessToken: res.accessToken,
        user: res.user,
        expiresInSec: res.expiresInSec,
      });
    },
  });
}
