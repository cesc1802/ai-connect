import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import type { ZodSchema } from "zod";
import type { ApiKeyVault } from "./api-key-vault.js";
import type { ProvidersRepository } from "./providers-repository.js";
import {
  ProviderDuplicateNameError,
  ProviderInUseError,
  ProviderNotFoundError,
  type OrgProvidersService,
  type ServiceActor,
} from "./providers-service.js";
import {
  checkConnection,
  type CheckTarget,
  type ConnectionChecker,
} from "./connection-checker.js";
import {
  checkProviderBody,
  createProviderBody,
  rotateKeyBody,
  updateProviderBody,
} from "./providers-route-schemas.js";

export interface ProvidersRoutesDeps {
  service: OrgProvidersService;
  repo: ProvidersRepository;
  vault: ApiKeyVault;
  /** Injectable for tests; defaults to the real HTTP checker. */
  checker?: ConnectionChecker;
}

function requireActor(req: { user?: { id: string; org: string } }): ServiceActor | null {
  if (!req.user) return null;
  return { userId: req.user.id, orgId: req.user.org };
}

function parseBody<T>(schema: ZodSchema<T>, body: unknown):
  | { data: T }
  | { error: { code: string; message: string } } {
  const parsed = schema.safeParse(body);
  if (parsed.success) return { data: parsed.data };
  const issue = parsed.error.issues[0];
  return {
    error: { code: "invalid_body", message: issue?.message ?? "Invalid request body" },
  };
}

// Express guarantees a matched `:id` segment is a single string at runtime.
function pathId(req: Request): string {
  const { id } = req.params;
  return typeof id === "string" ? id : "";
}

function statusForError(err: unknown): { status: number; code: string } | null {
  if (err instanceof ProviderNotFoundError) return { status: 404, code: err.code };
  if (err instanceof ProviderDuplicateNameError) return { status: 409, code: err.code };
  if (err instanceof ProviderInUseError) return { status: 409, code: err.code };
  return null;
}

/**
 * Org-admin `/providers` resource: CRUD + key rotation + live connection
 * check + provider catalog.
 */
export function createProvidersRoutes(deps: ProvidersRoutesDeps): Router {
  const { service, repo, vault } = deps;
  const checker = deps.checker ?? checkConnection;
  const router = Router();

  // Wrap a handler with the shared 401 + known-error → status mapping.
  const handle = (
    fn: (actor: ServiceActor, req: Request) => Promise<{ status: number; body?: unknown }>,
  ): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = requireActor(req);
        if (!actor) {
          res.status(401).json({ code: "unauthenticated", message: "Unauthenticated" });
          return;
        }
        const result = await fn(actor, req);
        if (result.body === undefined) res.status(result.status).send();
        else res.status(result.status).json(result.body);
      } catch (err) {
        const known = statusForError(err);
        if (known) {
          res.status(known.status).json({ code: known.code, message: (err as Error).message });
          return;
        }
        next(err);
      }
    };
  };

  router.get(
    "/",
    handle(async (actor) => ({ status: 200, body: { providers: await service.list(actor.orgId) } })),
  );

  router.get(
    "/catalog",
    handle(async () => ({ status: 200, body: { catalog: await repo.listCatalog() } })),
  );

  router.post(
    "/check",
    handle(async (actor, req) => {
      const parsed = parseBody(checkProviderBody, req.body);
      if ("error" in parsed) return { status: 400, body: parsed.error };
      const target = await resolveCheckTarget(parsed.data, actor, repo, vault);
      if ("status" in target) return target;
      return { status: 200, body: await checker(target) };
    }),
  );

  router.post(
    "/",
    handle(async (actor, req) => {
      const parsed = parseBody(createProviderBody, req.body);
      if ("error" in parsed) return { status: 400, body: parsed.error };
      const provider = await service.add(actor, {
        ...parsed.data,
        apiKey: parsed.data.apiKey ?? "",
      });
      return { status: 201, body: { provider } };
    }),
  );

  router.patch(
    "/:id",
    handle(async (actor, req) => {
      const parsed = parseBody(updateProviderBody, req.body);
      if ("error" in parsed) return { status: 400, body: parsed.error };
      const provider = await service.update(actor, pathId(req), parsed.data);
      return { status: 200, body: { provider } };
    }),
  );

  router.post(
    "/:id/rotate-key",
    handle(async (actor, req) => {
      const parsed = parseBody(rotateKeyBody, req.body);
      if ("error" in parsed) return { status: 400, body: parsed.error };
      const provider = await service.rotateKey(actor, pathId(req), parsed.data);
      return { status: 200, body: { provider } };
    }),
  );

  router.delete(
    "/:id",
    handle(async (actor, req) => {
      await service.delete(actor, pathId(req));
      return { status: 204 };
    }),
  );

  return router;
}

type CheckBody = (typeof checkProviderBody)["_output"];

/**
 * Resolve the check target: a stored provider (decrypting its key in-memory
 * only) with optional overrides, or an ad-hoc kind+credentials payload.
 */
async function resolveCheckTarget(
  body: CheckBody,
  actor: ServiceActor,
  repo: ProvidersRepository,
  vault: ApiKeyVault,
): Promise<CheckTarget | { status: number; body: unknown }> {
  if (!body.providerId) {
    return { providerKind: body.providerKind!, baseUrl: body.baseUrl, apiKey: body.apiKey };
  }
  const stored = await repo.findById(actor.orgId, body.providerId);
  if (!stored) {
    return {
      status: 404,
      body: { code: "provider_not_found", message: `Provider ${body.providerId} not found.` },
    };
  }
  let apiKey = body.apiKey;
  let usesStoredKey = false;
  if (!apiKey && stored.encryptedKey) {
    try {
      apiKey = vault.decrypt(stored.encryptedKey);
      usesStoredKey = true;
    } catch {
      return {
        status: 200,
        body: { ok: false, reason: "Stored API key failed to decrypt" },
      };
    }
  }
  return {
    providerKind: stored.providerKind,
    // The stored key must only ever travel to the provider's stored host;
    // honoring a caller-supplied baseUrl here would let it be exfiltrated.
    baseUrl: usesStoredKey ? stored.baseUrl : body.baseUrl ?? stored.baseUrl,
    apiKey,
  };
}
