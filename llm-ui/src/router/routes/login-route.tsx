import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { unauthenticatedRoute } from './unauthenticated-route';
import { LoginPage } from '@/pages/login-page';

const loginSearchSchema = z.object({
  from: z.string().optional(),
});

export const loginRoute = createRoute({
  getParentRoute: () => unauthenticatedRoute,
  path: '/login',
  validateSearch: loginSearchSchema,
  component: LoginPage,
});
