import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { logout } from '@/api/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';

/**
 * Clears local session state, fires logout request (best-effort),
 * resets the query cache, and routes back to /login.
 *
 * Network errors are swallowed: the user is already locally signed out;
 * stale server cookies will expire naturally.
 */
export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await logout();
      } catch {
        // Best-effort; local signout already happened below.
      }
    },
    onMutate: () => {
      useAuthStore.getState().clear();
      useActiveWorkspaceStore.getState().clear();
      queryClient.clear();
    },
    onSettled: () => {
      void navigate({ to: '/login' });
      toast.success('Signed out');
    },
  });
}
