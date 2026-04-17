# LLM Gateway - Code Standards & Guidelines

**Last Updated:** April 17, 2026  
**Version:** 1.1.0

## TypeScript Configuration

### Compiler Settings
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Enforcement:** No `any` types, `strict` mode mandatory, all exports typed.

## File Organization

### Module Structure
```
module-name/
├── public-interface.ts    # Main export file
├── implementation.ts      # Implementation details
├── types.ts              # Type definitions (if large)
├── __tests__/            # Vitest test suites
│   ├── public-interface.test.ts
│   └── implementation.test.ts
└── index.ts              # Re-exports for clarity
```

### Import Organization
```typescript
// 1. External imports (sorted)
import { LLMError } from "@opentelemetry/api";

// 2. Internal imports (from other modules)
import type { ChatRequest } from "../core/index.js";
import { Router } from "../routing/index.js";

// 3. Internal relative imports (least preferred)
import { validateRequest } from "./validation.js";

// 4. Type imports separated
import type { Config } from "./types.js";
```

**Rule:** Always use `index.js` for barrel exports; use `.js` extension in imports.

## Naming Conventions

### Files & Directories
- **Files:** kebab-case with descriptive names
  - ✓ `circuit-breaker.ts`, `anthropic-provider.ts`, `routing-strategy.ts`
  - ✗ `CB.ts`, `provider.ts` (ambiguous)
- **Directories:** kebab-case, plural for collections
  - ✓ `providers/`, `strategies/`, `resilience/`
- **Test Files:** Same name as source with `.test.ts` suffix
  - ✓ `circuit-breaker.test.ts` for `circuit-breaker.ts`

### Classes & Types
- **Classes:** PascalCase
  - ✓ `CircuitBreaker`, `AnthropicProvider`, `RoundRobinStrategy`
  - ✗ `circuitBreaker`, `anthropic_provider`
- **Interfaces:** PascalCase, prefix with `I` or suffix with `Config`/`Options`
  - ✓ `IRoutingStrategy`, `CircuitBreakerConfig`, `GatewayOptions`
  - ✗ `iCircuitBreakerConfig`, `strategy_config`
- **Enums:** PascalCase for enum name, UPPER_SNAKE_CASE for values
  - ✓ `enum CircuitState { CLOSED = "closed" }`
  - ✗ `enum circuitState { Closed }`
- **Type Unions:** Descriptive names, avoid single letters
  - ✓ `type ProviderName = "anthropic" | "openai" | "ollama"`
  - ✗ `type P = string`

### Variables & Functions
- **Variables:** camelCase
  - ✓ `const maxRetries = 3`, `let circuitState = "closed"`
  - ✗ `const max_retries = 3`, `let CIRCUIT_STATE = "closed"`
- **Functions:** camelCase, verb-noun pattern
  - ✓ `validateRequest()`, `selectProvider()`, `getLatency()`
  - ✗ `request_validate()`, `provider_select()`
- **Private Fields:** camelCase with `private` modifier
  - ✓ `private readonly providers = new Map()`
  - ✗ `private _providers`, `providers_` (no leading underscore)
- **Constants:** UPPER_SNAKE_CASE only if truly global
  - ✓ `const DEFAULT_TIMEOUT_MS = 30000` (exported)
  - ✓ `const maxSamples = 1000` (module-scoped)
  - ✗ `const DEFAULT_TIMEOUT = 30000` (missing unit in name)

### Abbreviations
- **Avoid:** Abbreviate only well-known terms
  - ✓ `LLMError`, `HTTPError`, `CBState`, `IDs`
  - ✗ `LlmError`, `LMError` (wrong casing/incomplete)
- **Units in Names:** Always include
  - ✓ `timeoutMs`, `latencyMs`, `delaySeconds`, `costPer1KTokens`
  - ✗ `timeout`, `latency`, `delay` (ambiguous)

## Class & Interface Design

### Provider Interface
```typescript
// Always implement the full contract
export interface LLMProvider {
  readonly name: ProviderName;
  readonly models: string[];
  capabilities(): ProviderCapabilities;
  supportsModel(model: string): boolean;
  chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
  streamCompletion(request: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamChunk>;
  dispose(): Promise<void>;
}

// Concrete implementations
export class MyProvider implements LLMProvider {
  readonly name: ProviderName = "my-provider";
  readonly models: string[] = ["model-1", "model-2*"];

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: false,
      jsonMode: true,
      maxContextTokens: 128000,
    };
  }

  supportsModel(model: string): boolean {
    return this.models.some((m) => {
      if (m.endsWith("*")) return model.startsWith(m.slice(0, -1));
      return m === model;
    });
  }

  async chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    // Implementation
  }

  async *streamCompletion(request: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamChunk> {
    // Implementation
  }

  async dispose(): Promise<void> {
    // Cleanup
  }
}
```

### Error Classes
```typescript
// Inherit from LLMError
export class ProviderError extends LLMError {
  constructor(
    message: string,
    public readonly providerName: ProviderName,
    public readonly originalError?: Error
  ) {
    super(message, "PROVIDER_ERROR");
    this.name = "ProviderError";
  }

  get isRetryable(): boolean {
    return true; // Determine based on error type
  }
}
```

### Configuration Classes
```typescript
// Define Config interfaces with all properties required
export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
  readonly probeRequests: number;
}

// Provide defaults
export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  probeRequests: 3,
};

// Merge strategy in usage
const config = { ...DEFAULT_CIRCUIT_BREAKER, ...userConfig };
```

## Error Handling

### Error Creation & Propagation
```typescript
// ✓ Do: Provide context and type information
try {
  const response = await provider.chatCompletion(request);
} catch (error) {
  if (error instanceof TimeoutError) {
    throw new TimeoutError(`Provider ${providerName} timed out after ${timeoutMs}ms`);
  }
  throw new ProviderError(
    `Request to ${providerName} failed: ${error.message}`,
    providerName,
    error as Error
  );
}

// ✗ Don't: Swallow errors or use generic messages
try {
  const response = await provider.chatCompletion(request);
} catch (error) {
  throw new Error("Failed"); // Too generic
}
```

### Abort Signal Handling
```typescript
// ✓ Do: Check abort at entry point
protected checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AbortError(new Error(signal.reason));
  }
}

// ✓ Do: Pass signal to underlying calls
const response = await fetch(url, { signal });

// ✗ Don't: Ignore abort signals
const response = await fetch(url); // Signal not passed
```

## Type Annotations

### Function Signatures
```typescript
// ✓ Do: Annotate parameters and return types explicitly
async function selectProvider(
  request: ChatRequest,
  healthyProviders: Map<ProviderName, LLMProvider>
): Promise<LLMProvider> {
  // Implementation
}

// ✓ Do: Use union types for specific options
function createRouter(strategy: "round-robin" | "cost-based" | "capability-based"): Router {
  // Implementation
}

// ✗ Don't: Rely on inference for public APIs
async function selectProvider(request) {
  // Unclear parameter type
}
```

### Generics
```typescript
// ✓ Do: Constrain generics meaningfully
class Cache<T extends { id: string }> {
  // Only caches objects with id field
}

// ✓ Do: Document generic constraints in JSDoc
/**
 * Wraps a provider with a decorator pattern.
 * @template P - The provider type (must extend LLMProvider)
 */
class ProviderDecorator<P extends LLMProvider> {
  // Implementation
}

// ✗ Don't: Use unconstrained generics
class Cache<T> {
  // Too broad - T could be anything
}
```

## Comments & Documentation

### JSDoc for Public APIs
```typescript
/**
 * Selects an appropriate provider for the given request.
 *
 * Selection logic:
 * 1. If request model specifies a provider, use it
 * 2. Otherwise, apply routing strategy
 * 3. Return first healthy provider found
 *
 * @param request - The chat completion request
 * @throws {ValidationError} If model is not supported
 * @throws {ProviderError} If no healthy providers available
 * @returns The selected provider instance
 *
 * @example
 * ```typescript
 * const provider = router.selectProvider(request);
 * ```
 */
selectProvider(request: ChatRequest): LLMProvider {
  // Implementation
}
```

### Inline Comments for Complex Logic
```typescript
// ✓ Do: Explain "why", not "what"
// Circuit breaker enters HALF_OPEN state after reset timeout
// to test if provider has recovered
const now = Date.now();
if (now - (this.openedAt?.getTime() ?? 0) > this.config.resetTimeoutMs) {
  this.state = CircuitState.HALF_OPEN;
  this.halfOpenRequests = 0;
}

// ✗ Don't: State the obvious
// Set the state to HALF_OPEN
this.state = CircuitState.HALF_OPEN;

// ✓ Do: Comment non-obvious algorithms
// Exponential backoff with jitter prevents thundering herd
const exponential = baseDelay * Math.pow(2, attempt);
const jitter = Math.random() * exponential * jitterFactor;
const delay = Math.min(exponential + jitter, maxDelay);
```

### Comment Standards
- **Single-line comments:** `//` for brief notes
- **Multi-line comments:** `/** */` for detailed documentation
- **TODO comments:** Use sparingly, include context
  - ✓ `// TODO: Implement cost-based routing once pricing data available`
  - ✗ `// TODO: fix this` (too vague)

## Testing Standards

### Test Structure
```typescript
describe("CircuitBreaker", () => {
  // Setup shared resources
  let circuitBreaker: CircuitBreaker;
  let mockProvider: Mock<LLMProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    circuitBreaker = new CircuitBreaker(mockProvider);
  });

  afterEach(async () => {
    await circuitBreaker.dispose();
  });

  describe("state transitions", () => {
    it("transitions from CLOSED to OPEN after failure threshold", async () => {
      // Arrange
      const failureCount = 5; // Matches DEFAULT_CIRCUIT_BREAKER.failureThreshold
      mockProvider.chatCompletion.mockRejectedValue(new ProviderError("Test", "test"));

      // Act
      for (let i = 0; i < failureCount; i++) {
        try {
          await circuitBreaker.chatCompletion(mockRequest);
        } catch {
          // Expected to fail
        }
      }

      // Assert
      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.OPEN);
    });

    it("throws CircuitOpenError when circuit is OPEN", async () => {
      // Arrange
      circuitBreaker.state = CircuitState.OPEN;

      // Act & Assert
      await expect(circuitBreaker.chatCompletion(mockRequest)).rejects.toThrow(CircuitOpenError);
    });
  });

  describe("error handling", () => {
    it("only retries on retryable errors", async () => {
      // Implementation
    });
  });
});
```

### Test Naming
- **Descriptive test names:** Start with "should" or "throws"
  - ✓ `it("should retry on timeout error")`
  - ✗ `it("test timeout")` (vague)
- **One assertion focus:** Each test validates one behavior
- **AAA Pattern:** Arrange, Act, Assert clearly separated

### Mocking Strategy
```typescript
// ✓ Do: Mock only what you need
const mockProvider = {
  name: "test" as ProviderName,
  models: ["test-model"],
  capabilities: () => ({ streaming: true, tools: true, vision: true, jsonMode: true, maxContextTokens: 128000 }),
  supportsModel: () => true,
  chatCompletion: vi.fn(),
  streamCompletion: vi.fn(),
  dispose: vi.fn(),
};

// ✗ Don't: Mock everything or use brittle deep mocks
const mockProvider = createMockProvider(); // Too opaque
```

## Async/Await Patterns

### Promise Handling
```typescript
// ✓ Do: Use async/await for readability
async function processRequest(request: ChatRequest): Promise<ChatResponse> {
  try {
    const response = await provider.chatCompletion(request);
    return response;
  } catch (error) {
    throw new ProviderError("Processing failed", "test", error as Error);
  }
}

// ✓ Do: Use Promise.all for concurrent operations
const results = await Promise.all(providers.map((p) => p.chatCompletion(request)));

// ✗ Don't: Mix callbacks and promises
provider.chatCompletion(request).then((response) => {
  callback(response); // Mixing styles
});
```

### AsyncIterable for Streaming
```typescript
// ✓ Do: Use async generators for streams
async *streamCompletion(request: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamChunk> {
  try {
    for await (const chunk of stream) {
      this.checkAbort(signal);
      yield chunk;
    }
  } catch (error) {
    throw new ProviderError("Stream failed", this.name, error as Error);
  }
}

// ✗ Don't: Return callbacks or events
function streamCompletion(request, callback) {
  stream.on("data", (chunk) => callback(chunk)); // Event-based
}
```

## Performance Patterns

### Circular Buffer for Sampling
```typescript
// ✓ Do: Use fixed-size circular buffer for metrics
class LatencyBuffer {
  private buffer: number[] = [];
  private index = 0;

  add(value: number): void {
    this.buffer[this.index % MAX_SIZE] = value;
    this.index++;
  }

  getAverage(): number {
    const count = Math.min(this.index, MAX_SIZE);
    const sum = this.buffer.slice(0, count).reduce((a, b) => a + b, 0);
    return sum / count;
  }
}
```

### Caching Strategy
```typescript
// ✓ Do: Cache provider instances
class ProviderFactory {
  private readonly instances = new Map<ProviderName, LLMProvider>();

  get(name: ProviderName): LLMProvider {
    if (!this.instances.has(name)) {
      this.instances.set(name, this.create(name));
    }
    return this.instances.get(name)!;
  }
}
```

### Map Over Arrays for Lookups
```typescript
// ✓ Do: Use Map for O(1) lookups
private readonly circuitBreakers = new Map<ProviderName, CircuitBreaker>();

// ✗ Don't: Use arrays with find()
private circuitBreakers: CircuitBreaker[] = []; // O(n) lookup
```

## Security Practices

### No Sensitive Data in Logs
```typescript
// ✓ Do: Sanitize error messages
throw new AuthenticationError(
  `Authentication failed for provider ${providerName}` // No API key
);

// ✗ Don't: Log secrets
throw new AuthenticationError(
  `Authentication failed: API key ${apiKey} invalid` // SECURITY RISK
);
```

### Input Validation
```typescript
// ✓ Do: Validate all external input
protected validateRequest(request: ChatRequest): void {
  if (!request.model) {
    throw new ValidationError("Model is required", "model");
  }
  if (request.maxTokens <= 0) {
    throw new ValidationError("maxTokens must be positive", "maxTokens");
  }
}

// ✗ Don't: Assume input is valid
async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
  // Direct use of request.model without validation
}
```

## Module Pattern

### Barrel Exports
```typescript
// ✓ Do: Re-export public API from index.ts
// router.ts
export class Router { /* implementation */ }
export interface RouterConfig { /* ... */ }

// index.ts (in same directory)
export { Router, RouterConfig } from "./router.js";
export { RoundRobinStrategy, CostBasedStrategy } from "./strategies/index.js";
```

### Visibility Control
```typescript
// ✓ Do: Use private/protected for implementation details
export class CircuitBreaker {
  private state = CircuitState.CLOSED; // Not exported
  private failures = 0;

  // Public read-only access
  getMetrics(): CircuitMetrics {
    return { state: this.state, /* ... */ };
  }
}

// ✗ Don't: Expose internal state
export class CircuitBreaker {
  state = CircuitState.CLOSED; // Publicly mutable!
}
```

## Build & Deployment

### Compilation Targets
- **Format:** ES2022 modules with .js extensions
- **Output:** Single tsconfig.json, strict mode
- **Testing:** Vitest with TypeScript support

### Entry Points
```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./providers": {
      "types": "./dist/providers/index.d.ts",
      "import": "./dist/providers/index.js"
    }
  }
}
```

## Code Review Checklist

Before merging:
- [ ] All tests pass (vitest)
- [ ] No TypeScript errors (strict mode)
- [ ] JSDoc for public APIs
- [ ] Error handling for all paths
- [ ] Abort signal handling (if async)
- [ ] No hardcoded secrets or API keys
- [ ] Naming follows conventions
- [ ] Comments explain "why", not "what"
- [ ] No dead code or TODO comments
- [ ] Performance considerations documented

## Authentication & Authorization Patterns

### Repository Pattern

**Purpose:** Abstract data access layer for testability and decoupling from storage implementation.

```typescript
// ✓ Do: Define interface first
export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  // Other operations: findById, save, etc.
}

// ✓ Do: Type the record separately
export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  // Don't expose password directly
}

// ✓ Do: Implement with async methods even if in-memory
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>();

  constructor(initialUsers: UserRecord[]) {
    initialUsers.forEach(u => this.users.set(u.username, u));
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    return this.users.get(username) ?? null;
  }
}

// ✗ Don't: Mix synchronous and asynchronous implementations
export class UserRepository {
  findByUsername(username: string): UserRecord | null {
    // Later someone adds async implementation - now it's confusing
  }
}
```

### Service Initialization Pattern

**Purpose:** Services that depend on repositories or configuration should accept dependencies as constructor parameters.

```typescript
// ✓ Do: Accept dependencies in constructor
export class CredentialsVerifier {
  constructor(
    private readonly userRepository: UserRepository
  ) {}

  async verify(username: string, password: string): Promise<User | null> {
    const record = await this.userRepository.findByUsername(username);
    if (!record) return null;
    
    const isValid = await bcrypt.compare(password, record.passwordHash);
    return isValid ? { id: record.id, username: record.username } : null;
  }
}

// ✓ Do: Services should be stateless or thread-safe
export class JwtService {
  private readonly options: jwt.SignOptions;

  constructor(private secret: string, expiresIn: string) {
    // Immutable configuration
    this.options = { expiresIn: expiresIn as `${number}${"s" | "m" | "h" | "d"}` };
  }

  sign(user: User): string {
    // No side effects, safe to call concurrently
    return jwt.sign({ sub: user.id, username: user.username }, this.secret, this.options);
  }
}

// ✗ Don't: Global state or singletons without injection
let globalRepository: UserRepository;
export function setRepository(repo: UserRepository) {
  globalRepository = repo; // Hard to test
}
```

### Middleware Factory Pattern

**Purpose:** Middleware that depends on services should be created via factory functions.

```typescript
// ✓ Do: Return middleware function from factory
export function createRequireAuth(container: AppContainer): RequestHandler {
  return (req, res, next) => {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({
        code: "missing_token",
        message: "Authorization header required",
      });
      return;
    }

    try {
      const token = header.slice(7);
      const payload = container.jwtService.verify(token);
      req.user = { id: payload.sub, username: payload.username };
      next();
    } catch {
      res.status(401).json({
        code: "invalid_token",
        message: "Token invalid or expired",
      });
    }
  };
}

// ✓ Do: Use factory to pass dependencies to middleware
const requireAuth = createRequireAuth(container);
app.get("/protected", requireAuth, (req, res) => {
  // req.user is now available
});

// ✗ Don't: Middleware that directly accesses global state
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.slice(7);
  const payload = globalJwtService.verify(token); // Global dependency - hard to test
}
```

### Request Validation Pattern

**Purpose:** Validate incoming request data before processing.

```typescript
// ✓ Do: Use Zod for schema validation with safeParse
import { z } from "zod";

const loginBodySchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

router.post("/login", async (req, res) => {
  const parsed = loginBodySchema.safeParse(req.body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    res.status(400).json({
      code: "invalid_body",
      message: firstIssue?.message ?? "Invalid request body",
    });
    return;
  }

  const { username, password } = parsed.data;
  // Process validated data
});

// ✗ Don't: Manual validation or throw-based parsing
router.post("/login", (req, res) => {
  if (!req.body.username) throw new Error("Username required"); // No error context
  if (!req.body.password) throw new Error("Password required");
});
```

### Configuration Injection

**Purpose:** Services receive config objects, not read from process.env directly.

```typescript
// ✓ Do: Centralize config loading
export interface Config {
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  NODE_ENV: "development" | "production";
}

// Load and validate once
function loadConfig(): Config {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET required");
  
  return {
    JWT_SECRET: secret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "24h",
    NODE_ENV: (process.env.NODE_ENV ?? "development") as any,
  };
}

// ✓ Do: Pass config to services
const config = loadConfig();
const jwtService = new JwtService(config.JWT_SECRET, config.JWT_EXPIRES_IN);

// ✗ Don't: Services read from process.env directly
export class JwtService {
  constructor() {
    this.secret = process.env.JWT_SECRET!; // Tightly coupled to env
  }
}
```

### Command Pattern for Message Handlers

**Purpose:** Dispatch messages to type-specific handlers using discriminated unions and polymorphism.

```typescript
// ✓ Do: Define handler interface with type discriminator
export interface WsCommandHandler<T extends ClientMessage = ClientMessage> {
  readonly type: T["type"]; // Discriminator: "chat" | "ping"
  handle(socket: AuthenticatedSocket, msg: T, send: SendFn, ctx: HandlerContext): void;
}

// ✓ Do: Implement handlers for each message type
export class ChatCommandHandler implements WsCommandHandler<ChatMessage> {
  readonly type = "chat" as const;

  constructor(private readonly streamChat: StreamChatUseCase) {}

  handle(socket: AuthenticatedSocket, msg: ChatMessage, send: SendFn, ctx: HandlerContext): void {
    ctx.activeStream.handle?.abort(); // Cancel previous stream
    
    ctx.activeStream.handle = this.streamChat.execute(
      { model: msg.model, messages: msg.messages, maxTokens: msg.maxTokens ?? 4096 },
      {
        onChunk: (delta) => send({ type: "chunk", delta }),
        onDone: (usage, finishReason) => {
          send({ type: "done", usage, finishReason });
          ctx.activeStream.handle = null;
        },
        onError: (err) => {
          send({ type: "error", code: mapErrorToCode(err), message: sanitizeErrorMessage(err) });
          ctx.activeStream.handle = null;
        },
      }
    );
  }
}

// ✓ Do: Create handler map for dispatch
type WsCommandHandlerMap = {
  [K in ClientMessage["type"]]?: WsCommandHandler<Extract<ClientMessage, { type: K }>>;
};

const handlers: WsCommandHandlerMap = {
  chat: new ChatCommandHandler(streamChat),
  ping: new PingCommandHandler(),
};

// ✓ Do: Use discriminated union to ensure type safety
for (const [type, handler] of Object.entries(handlers)) {
  if (handler?.type === type) {
    // TypeScript knows handler matches the type
  }
}

// ✗ Don't: Use string-based dispatch without type safety
const handler = handlers[msg.type as string]; // Lost type information
```

**Handler Context Pattern:**

```typescript
// ✓ Do: Share mutable context across handler invocations
interface HandlerContext {
  activeStream: { handle: StreamHandle | null };
  // Add other state that needs to persist across messages
}

// Context created once per connection
const ctx: HandlerContext = { activeStream: { handle: null } };

// Reused for each incoming message
ws.on("message", (raw) => {
  // Parse and dispatch to handler
  handler.handle(socket, msg, send, ctx); // Context carries state
});

// ✗ Don't: Create new context per message (loses state)
ws.on("message", (raw) => {
  const ctx = { activeStream: { handle: null } }; // Fresh context = lost stream reference
  handler.handle(socket, msg, send, ctx);
});
```

**Error Mapping Pattern:**

```typescript
// ✓ Do: Map typed errors to client error codes
const ERROR_CODE_MAP: Record<string, string> = {
  AuthenticationError: "provider_auth_error",
  RateLimitError: "provider_rate_limit",
  TimeoutError: "provider_timeout",
  CircuitOpenError: "provider_unavailable",
  ValidationError: "invalid_request",
};

export function mapErrorToCode(err: Error): string {
  return ERROR_CODE_MAP[err.name] ?? "internal_error";
}

// ✓ Do: Sanitize messages for sensitive errors
export function sanitizeErrorMessage(err: Error): string {
  const code = mapErrorToCode(err);
  if (code === "internal_error") {
    return "An unexpected error occurred"; // Generic for security
  }
  return err.message; // Safe to expose provider-specific errors
}

// ✗ Don't: Expose internal error details
throw new Error(`Database query failed: ${query}`); // Leaks internals
```

**Message Validation Pattern:**

```typescript
// ✓ Do: Use Zod discriminated unions for type-safe validation
const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat"),
    id: z.string().min(1).max(64),
    model: z.string().min(1),
    messages: z.array(chatMessageSchema).min(1),
    maxTokens: z.number().int().positive().max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
  }),
  z.object({
    type: z.literal("ping"),
    id: z.string().optional(),
  }),
]);

const result = clientMessageSchema.safeParse(parsed);
if (!result.success) {
  send({ type: "error", code: "invalid_message", message: result.error.issues[0]?.message });
  return;
}

const msg = result.data; // TypeScript knows exact type based on type field

// ✗ Don't: Parse without discrimination
const msg = z.object({ type: z.string(), ...commonFields }).parse(parsed);
// Now msg.type is string, not "chat" | "ping"
```

**Backpressure Handling Pattern:**

```typescript
// ✓ Do: Check buffer before sending and drop if saturated
const BACKPRESSURE_MAX = 1_000_000; // 1MB

const send: SendFn = (msg: ServerMessage) => {
  if (ws.bufferedAmount > BACKPRESSURE_MAX) {
    logger.warn({ user: ws.user.username }, "backpressure: dropping message");
    return; // Drop message, don't block
  }
  ws.send(JSON.stringify(msg));
};

// ✓ Do: Log backpressure events for monitoring
logger.warn("backpressure", { bufferedAmount: ws.bufferedAmount, user: ws.user.username });

// ✗ Don't: Block or queue indefinitely
if (ws.bufferedAmount > BACKPRESSURE_MAX) {
  await new Promise(resolve => setTimeout(resolve, 100)); // Blocks handler
}

// ✗ Don't: Ignore backpressure silently
ws.send(JSON.stringify(msg)); // May cause memory leak
```

**Message Size Limits Pattern:**

```typescript
// ✓ Do: Validate size before parsing
const MESSAGE_SIZE_LIMIT = 1_000_000; // 1MB

ws.on("message", (raw) => {
  const rawStr = raw.toString();
  if (rawStr.length > MESSAGE_SIZE_LIMIT) {
    send({ type: "error", code: "message_too_large", message: "Message exceeds 1MB limit" });
    return;
  }

  // Parse and validate
  const parsed = JSON.parse(rawStr);
  const result = clientMessageSchema.safeParse(parsed);
});

// ✗ Don't: Parse first, validate size later
const parsed = JSON.parse(rawStr); // Might fail on huge payload
if (rawStr.length > MESSAGE_SIZE_LIMIT) { /* too late */ }
```

---

### Password Hashing Security

**Purpose:** Never store or transmit plaintext passwords.

```typescript
// ✓ Do: Hash passwords with bcrypt
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;
const hash = await bcrypt.hash(plaintextPassword, BCRYPT_ROUNDS);

// ✓ Do: Compare against hash, not plaintext
const isValid = await bcrypt.compare(plaintextPassword, storedHash);

// ✓ Do: Use generated hashes in seed data
// tsx scripts/hash-password.ts mypassword
// Output: $2a$10$...hash...

// ✗ Don't: Store plaintext
const user = { username: "demo", password: "mypassword" };

// ✗ Don't: Compare plaintext to plaintext
if (inputPassword === user.password) { /* ... */ }
```

## Deprecated Patterns

**Avoid:**
- `var` declarations (use `const` or `let`)
- Function expressions (use arrow functions or async functions)
- `any` types (use proper types or `unknown` + narrowing)
- Null checks (use optional chaining `?.` and nullish coalescing `??`)
- Callback hell (use async/await)
- String-based model names (use provider-scoped naming)
- Global state in middleware (use dependency injection via factories)
- Reading from process.env in service constructors (pass config objects)
