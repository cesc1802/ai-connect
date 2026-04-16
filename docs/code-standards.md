# LLM Gateway - Code Standards & Guidelines

**Last Updated:** April 16, 2026  
**Version:** 1.0.0

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

## Deprecated Patterns

**Avoid:**
- `var` declarations (use `const` or `let`)
- Function expressions (use arrow functions or async functions)
- `any` types (use proper types or `unknown` + narrowing)
- Null checks (use optional chaining `?.` and nullish coalescing `??`)
- Callback hell (use async/await)
- String-based model names (use provider-scoped naming)
