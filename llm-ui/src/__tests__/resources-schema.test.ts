import { describe, expect, it } from 'vitest';
import {
  Model,
  Provider,
  ProviderKind,
  WorkspaceResourcesResponse,
} from '@/schemas/resources';

describe('resources schema', () => {
  it('parses a happy-path WorkspaceResourcesResponse', () => {
    const payload = {
      providers: [
        {
          id: 'prv_1',
          displayName: 'OpenAI',
          providerKind: 'openai',
          isEnabled: true,
          models: [
            { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000 },
            { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini' },
          ],
        },
      ],
    };
    const parsed = WorkspaceResourcesResponse.parse(payload);
    expect(parsed.providers).toHaveLength(1);
    expect(parsed.providers[0].models).toHaveLength(2);
    expect(parsed.providers[0].models[1].contextWindow).toBeUndefined();
  });

  it('accepts every ProviderKind value', () => {
    for (const kind of ['openai', 'anthropic', 'google', 'azure-openai', 'custom']) {
      expect(ProviderKind.parse(kind)).toBe(kind);
    }
  });

  it('rejects an unknown providerKind', () => {
    const bad = {
      providers: [
        {
          id: 'p',
          displayName: 'X',
          providerKind: 'mystery-provider',
          isEnabled: true,
          models: [],
        },
      ],
    };
    expect(() => WorkspaceResourcesResponse.parse(bad)).toThrow();
  });

  it('rejects a Model with non-positive contextWindow', () => {
    expect(() =>
      Model.parse({ id: 'm', displayName: 'M', contextWindow: 0 }),
    ).toThrow();
    expect(() =>
      Model.parse({ id: 'm', displayName: 'M', contextWindow: -10 }),
    ).toThrow();
  });

  it('rejects a Provider missing required fields', () => {
    expect(() =>
      Provider.parse({
        id: 'p',
        displayName: 'X',
        providerKind: 'openai',
        models: [],
      }),
    ).toThrow();
  });

  it('rejects WorkspaceResourcesResponse with malformed payload', () => {
    expect(() => WorkspaceResourcesResponse.parse({})).toThrow();
    expect(() => WorkspaceResourcesResponse.parse({ providers: 'nope' })).toThrow();
    expect(() =>
      WorkspaceResourcesResponse.parse({ providers: [{ id: 'p' }] }),
    ).toThrow();
  });

  it('does not require the allowedRoles field (server must not leak it)', () => {
    const parsed = WorkspaceResourcesResponse.parse({
      providers: [
        {
          id: 'p',
          displayName: 'X',
          providerKind: 'openai',
          isEnabled: true,
          models: [],
        },
      ],
    });
    expect((parsed.providers[0] as Record<string, unknown>).allowedRoles).toBeUndefined();
  });
});
