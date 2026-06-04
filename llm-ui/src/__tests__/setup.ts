import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/mocks/server';

// jsdom does not implement window.scrollTo; TanStack Router's scroll
// restoration calls it after every navigation in tests.
window.scrollTo = () => {};

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
