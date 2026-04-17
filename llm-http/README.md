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
| `RATE_LIMIT_CHAT_WINDOW_MS` | No | 3600000 | Chat rate limit window (1 hour) |
| `RATE_LIMIT_CHAT_MAX` | No | 60 | Max chat requests per window |
| `ANTHROPIC_API_KEY` | No | - | Anthropic API key |
| `OPENAI_API_KEY` | No | - | OpenAI API key |
| `OLLAMA_BASE_URL` | No | http://localhost:11434 | Ollama server URL |

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
  -d '{"username": "demo", "password": "password123"}'
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

### REST Chat

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "model": "claude-sonnet-4",
    "messages": [{"role": "user", "content": "Hello!"}],
    "maxTokens": 1024
  }'
```

Success (200):
```json
{
  "id": "msg_xxx",
  "content": "Hello! How can I help you today?",
  "toolCalls": [],
  "usage": { "inputTokens": 10, "outputTokens": 15, "totalTokens": 25 },
  "model": "claude-sonnet-4",
  "finishReason": "stop",
  "latencyMs": 345
}
```

## WebSocket Protocol

Connect with JWT token in query parameter:

```bash
wscat -c "ws://localhost:3000/chat?token=<jwt>"
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
  streamChatUseCase: StreamChatUseCase;
  oneShotChatUseCase: OneShotChatUseCase;
  wsCommandHandlers: WsCommandHandlerMap;
}
```

### Ports and Adapters

- `ChatGatewayPort`: Interface for LLM operations
- `LlmGatewayAdapter`: Production implementation wrapping llm-gateway
- `NullGatewayAdapter`: Stub for development without providers

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
