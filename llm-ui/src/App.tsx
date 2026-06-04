import { useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { router } from '@/router';
import { createQueryClient } from '@/lib/query-client';
import { AuthBootstrap } from '@/pages/auth-bootstrap';
import { useRouterSession } from '@/hooks/use-router-session';

function RouterWithSession() {
  const session = useRouterSession();
  return <RouterProvider router={router} context={{ session }} />;
}

export default function App() {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>
          <AuthBootstrap>
            <RouterWithSession />
          </AuthBootstrap>
          <Toaster richColors closeButton position="bottom-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
