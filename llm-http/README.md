# @ai-connect/http

HTTP/WebSocket server providing REST API and real-time streaming interface to the LLM Gateway.

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env

# Run development server
pnpm --filter @ai-connect/http dev
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | development | Environment (development/production) |
| `PORT` | No | 3000 | Server port |
| `LOG_LEVEL` | No | info | Logging level (fatal/error/warn/info/debug/trace) |
| `JWT_SECRET` | **Yes** | - | HS256 signing key (min 32 chars recommended) |
| `JWT_EXPIRES_IN` | No | 24h | Token expiration (e.g., "1h", "24h", "7d") |
| `DEMO_USERS` | No | [] | JSON array of seeded users |
| `RATE_LIMIT_LOGIN_WINDOW_MS` | No | 900000 | Login rate limit window (15 min) |
| `RATE_LIMIT_LOGIN_MAX` | No | 5 | Max login attempts per window |
| `PROVIDER_KEY_VAULT_KEY` | **Yes** (non-test) | - | 32-byte hex key encrypting stored provider API keys |
| `PROVIDER_REFRESH_TTL_MS` | No | 60000 | Gateway provider config refresh interval (min 1000) |

LLM providers are configured in the database via the org admin API (`/api/admin/org/providers`), not env vars. The gateway re-reads them once per `PROVIDER_REFRESH_TTL_MS` window, so admin changes apply without a restart.

### DEMO_USERS Format

```json
[
  {
    "id": "user-1",
    "username": "demo",
    "passwordHash": "$2a$10$..."
  }
]
```

Generate password hashes with:
```bash
pnpm --filter @ai-connect/http tsx scripts/hash-password.ts <password>
```

## HTTP Endpoints

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{ "status": "ok" }
```

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "admin123456"}'
```

Success (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

Error (401):
```json
{ "code": "invalid_credentials", "message": "Invalid username or password" }
```

## WebSocket Protocol

Chat is served exclusively over WebSocket at `/ws/chat/v2`. Connect with a JWT token in the query parameter:

```bash
wscat -c "ws://localhost:3000/ws/chat/v2?token=<jwt>"
```

### Client Messages

**Chat Request:**
```json
{
  "type": "chat",
  "id": "req-1",
  "model": "claude-sonnet-4",
  "messages": [{"role": "user", "content": "Hello!"}],
  "maxTokens": 4096,
  "temperature": 0.7
}
```

**Ping (keepalive):**
```json
{ "type": "ping" }
```

### Server Messages

**Chunk (streaming delta):**
```json
{ "type": "chunk", "id": "req-1", "delta": "Hello" }
```

**Done (stream complete):**
```json
{
  "type": "done",
  "id": "req-1",
  "usage": { "inputTokens": 10, "outputTokens": 25, "totalTokens": 35 },
  "finishReason": "stop"
}
```

**Error:**
```json
{ "type": "error", "id": "req-1", "code": "provider_timeout", "message": "Request timed out" }
```

**Pong:**
```json
{ "type": "pong" }
```

### Error Codes

| Code | Description |
|------|-------------|
| `invalid_json` | Malformed JSON |
| `invalid_message` | Schema validation failed |
| `message_too_large` | Message exceeds 1MB |
| `unknown_type` | Unknown message type |
| `provider_auth_error` | Provider authentication failed |
| `provider_rate_limit` | Provider rate limit exceeded |
| `provider_timeout` | Request timed out |
| `provider_unavailable` | Circuit breaker open |
| `all_providers_failed` | All fallback providers failed |
| `model_not_found` | Model not available |
| `content_filtered` | Content policy violation |
| `request_cancelled` | Request aborted |
| `internal_error` | Unexpected server error |

## Architecture

### Container-Based Dependency Injection

The server uses manual DI with a centralized container:

```typescript
interface AppContainer {
  config: Config;
  logger: Logger;
  chatGateway: ChatGatewayPort;
  userRepository: UserRepository;
  credentialsVerifier: CredentialsVerifier;
  jwtService: JwtService;
  chatHandler: ChatHandler;
}
```

### Ports and Adapters

- `ChatGatewayPort`: Interface for LLM operations
- `LlmGatewayAdapter`: Production implementation wrapping llm-gateway
- `DbProviderConfigSource`: Loads enabled providers from the database into the gateway

### Testing Strategy

Tests use a test container with fake implementations:

```typescript
const container = buildTestContainer({
  chatGateway: new FakeChatGateway(["Hello", " world"]),
});
```

No `vi.mock()` or module mocking - just interface-based fakes.

## Scripts

```bash
# Development server with hot reload
pnpm --filter @ai-connect/http dev

# Production build
pnpm --filter @ai-connect/http build

# Run tests
pnpm --filter @ai-connect/http test

# Run tests with coverage
pnpm --filter @ai-connect/http test:coverage

# Type check
pnpm --filter @ai-connect/http typecheck

# Generate password hash
pnpm --filter @ai-connect/http tsx scripts/hash-password.ts <password>
```

## Limitations

- **In-memory users**: Users seeded from env var, no persistence
- **Single instance**: Rate limit state not shared across instances
- **Token in query**: WebSocket auth uses query param (visible in logs)
- **No refresh tokens**: JWT must be reissued via login on expiry
