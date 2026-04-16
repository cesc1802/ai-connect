# LLM Gateway - Project Overview & Product Requirements

**Last Updated:** April 16, 2026  
**Status:** Active Development  
**Version:** 1.0.0

## Executive Summary

LLM Gateway is a unified TypeScript SDK that abstracts over multiple Large Language Model (LLM) providers, providing a single consistent API while integrating resilience patterns, intelligent routing, and observability. It enables applications to work with Anthropic Claude, OpenAI GPT, Ollama, and MiniMax models through a provider-agnostic interface.

## Problem Statement

Modern applications require flexibility to:
- Support multiple LLM providers simultaneously
- Switch providers based on cost, availability, or capability constraints
- Handle provider failures gracefully with fallback mechanisms
- Monitor and observe LLM service performance
- Implement request retry logic and circuit breaking

Without a unified abstraction, applications must implement provider-specific code, duplicate error handling, and reinvent resilience patterns.

## Solution Overview

LLM Gateway provides:
1. **Unified Type System**: Single request/response interface across all providers
2. **Provider Abstraction**: Abstract base class with concrete implementations
3. **Intelligent Routing**: Select providers based on cost, capability, or round-robin strategy
4. **Resilience Patterns**: Circuit breaker, retry logic, and fallback chains
5. **Observability**: OpenTelemetry-based tracing and metrics
6. **Factory Pattern**: Centralized provider instantiation and lifecycle management

## Core Features

### 1. Multi-Provider Support

| Provider | Streaming | Tools | Vision | JSON Mode | Max Tokens |
|----------|-----------|-------|--------|-----------|------------|
| **Anthropic** | ✓ | ✓ | ✓ | ✗ | 200K |
| **OpenAI** | ✓ | ✓ | ✓ | ✓ | 128K |
| **Ollama** | ✓ | ✓ | ✓ | ✓ | 128K |
| **MiniMax** | ✓ | ✗ | ✗ | ✗ | 245K |

### 2. Resilience Patterns

**Circuit Breaker:** Prevents cascading failures by stopping requests to unhealthy providers  
- States: CLOSED (normal) → OPEN (blocked) → HALF_OPEN (recovery)
- Default: 5 consecutive failures trigger OPEN state, 30-second reset timeout
- 3 successful probes in HALF_OPEN return to CLOSED

**Retry Decorator:** Transparent request retry with exponential backoff  
- Selective: Retries on TIMEOUT, RATE_LIMIT, PROVIDER_ERROR only
- Exponential backoff: Base 1s, max jitter, default max 3 retries
- Preserves abort signals for cancellation

**Fallback Chain:** Sequential provider fallback for redundancy  
- Attempts providers in order until success
- Aggregates provider capabilities for request validation
- Throws FallbackExhaustedError if all providers fail

### 3. Routing Strategies

**Round-Robin:** Load balance across healthy providers  
**Cost-Based:** Prioritize cheaper providers (configurable cost per 1K tokens)  
**Capability-Based:** Match provider capabilities to request requirements

### 4. Type System

**Unified Message Format:**
```typescript
ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | ContentBlock[]
  name?: string
  toolCallId?: string
}

ContentBlock = { type: "text"; text: string }
            | { type: "image"; source: ImageSource }
```

**Request & Response:**
- `ChatRequest`: model, messages, maxTokens, temperature, tools, responseFormat
- `ChatResponse`: content, toolCalls, usage, finishReason, latencyMs
- `StreamChunk`: incremental deltas with tool call tracking

### 5. Configuration Management

- Environment variable support: Provider API keys and base URLs auto-loaded
- Validation: Provider configs, circuit breaker settings, retry policies
- Merge strategy: Environment variables override defaults
- Timeout handling: Per-request and global defaults

### 6. Observability

**OpenTelemetry Integration:**
- **Spans:** llm.chat, llm.stream with GenAI semantic conventions
- **Metrics:**
  - `llm.requests` (counter): Total requests per provider
  - `llm.errors` (counter): Error counts by type
  - `llm.latency` (histogram): Request duration distribution
  - `llm.tokens` (counter): Input/output token usage

## Functional Requirements

### FR1: Unified Chat API
- Provide consistent `chat()` method across all providers
- Normalize responses to common `ChatResponse` format
- Track latency and token usage automatically

### FR2: Streaming Support
- Enable streaming responses via `stream()` method
- Yield incremental chunks with delta updates
- Support tool call tracking in streams

### FR3: Multi-Provider Factory
- Instantiate providers with lazy loading
- Cache provider instances for reuse
- Support bulk operations (create, list, dispose)

### FR4: Provider Selection
- Route requests based on provider name or routing strategy
- Validate model availability before requesting
- Fail fast with clear error messages

### FR5: Resilience & Failover
- Implement circuit breaker for each provider
- Retry failed requests with exponential backoff
- Chain fallback providers for guaranteed redundancy

### FR6: Metrics & Observability
- Export OpenTelemetry metrics to configured exporter
- Track request counts, errors, latency, and token usage
- Provide health status for all providers

### FR7: Configuration
- Load provider configs from environment variables
- Validate all configurations at startup
- Support per-request timeout overrides

## Non-Functional Requirements

### NFR1: Performance
- **Latency:** Request handling <100ms overhead per gateway call
- **Throughput:** Support concurrent requests with no provider-specific limits
- **Memory:** Circular buffer for latency tracking (fixed 1000 samples)

### NFR2: Reliability
- **Error Recovery:** All provider failures handled gracefully
- **State Management:** Circuit breaker state transitions atomic and thread-safe
- **Resource Cleanup:** Proper disposal of provider connections

### NFR3: Maintainability
- **Type Safety:** Full TypeScript support with strict mode
- **Modularity:** Provider-agnostic base class; concrete implementations isolated
- **Documentation:** Examples for each provider and use case

### NFR4: Observability
- **Tracing:** Distributed tracing with OpenTelemetry
- **Metrics:** Standard metrics for monitoring dashboards
- **Logging:** Error context and diagnostic information

## Architecture Overview

```
LLMGateway (Main Entry Point)
├── ProviderFactory (Instantiation & Caching)
├── Router (Provider Selection)
│   ├── RoundRobinStrategy
│   ├── CostBasedStrategy
│   └── CapabilityBasedStrategy
├── CircuitBreaker (Per-Provider Resilience)
├── RetryDecorator (Transparent Retry)
├── FallbackChain (Multi-Provider Fallback)
├── LLMTracer (OpenTelemetry Spans)
└── LLMMetrics (OpenTelemetry Metrics)
```

**Concrete Providers:**
- AnthropicProvider (SDK-based)
- OpenAIProvider (SDK-based)
- OllamaProvider (Fetch-based)
- MiniMaxProvider (Fetch-based)

## API Boundaries

### Primary Interface

```typescript
// Main gateway creation
const gateway = new LLMGateway(config: GatewayConfig)

// Chat and streaming
gateway.chat(request: ChatRequest, options?: GatewayRequestOptions)
gateway.stream(request: ChatRequest, options?: GatewayRequestOptions)

// Provider management
gateway.getProvider(name: ProviderName)
gateway.getProviderNames(): ProviderName[]
gateway.isProviderHealthy(name: ProviderName): boolean

// Metrics and health
gateway.getMetrics(): GatewayMetrics
gateway.createFallbackChain(providers: ProviderName[]): LLMProvider

// Cleanup
gateway.dispose(): Promise<void>
```

### Error Hierarchy

```
LLMError (base)
├── ProviderError
├── RateLimitError
├── AuthenticationError
├── TimeoutError
├── CircuitOpenError
├── FallbackExhaustedError
├── ModelNotFoundError
├── ContentFilterError
└── ValidationError
```

## Acceptance Criteria

1. ✓ All providers (Anthropic, OpenAI, Ollama, MiniMax) supported
2. ✓ Unified message/response types across providers
3. ✓ Circuit breaker prevents cascading failures
4. ✓ Retry decorator handles transient errors
5. ✓ Fallback chains execute in order
6. ✓ OpenTelemetry metrics exported
7. ✓ Configuration validates at startup
8. ✓ Examples demonstrate all use cases
9. ✓ Type safety with strict TypeScript
10. ✓ All unit tests pass

## Success Metrics

| Metric | Target |
|--------|--------|
| Test Coverage | >85% |
| Type Safety | 100% (strict mode) |
| Provider Support | 4+ major providers |
| Documentation | Complete examples for all features |
| Error Recovery | 100% graceful handling |
| Latency Overhead | <100ms per gateway call |

## Timeline & Milestones

**Phase 1: Foundation** (Complete)
- Type system and error hierarchy
- Base provider and factory pattern

**Phase 2: Providers** (Complete)
- Anthropic, OpenAI, Ollama, MiniMax implementations
- Multi-modal message support (vision)
- Tool calling support

**Phase 3: Resilience** (Complete)
- Circuit breaker
- Retry decorator
- Fallback chains

**Phase 4: Routing** (Complete)
- Round-robin strategy
- Cost-based routing
- Capability-based routing

**Phase 5: Telemetry** (Complete)
- OpenTelemetry tracing
- Metrics collection and export

**Phase 6: Documentation & Examples** (In Progress)
- README and quick start guide
- Complete API documentation
- Usage examples for all features
- Architecture and design documentation

## Dependencies

### External Libraries
- `@anthropic-ai/sdk` (Anthropic)
- `openai` (OpenAI)
- `@opentelemetry/api` (Observability)
- `tsx` (TypeScript execution, dev only)
- `vitest` (Testing, dev only)

### Runtime Requirements
- Node.js ≥16.0.0
- TypeScript ≥5.0

## Known Limitations

1. **MiniMax**: No tool calling support (provider limitation)
2. **Anthropic**: No JSON mode support (provider limitation)
3. **Streaming**: Some providers have different chunk formats (normalized by base)
4. **Context Length**: Different max tokens per provider (documented in capabilities)

## Future Enhancements

1. Caching layer for identical requests
2. Rate limiter abstraction across providers
3. Cost estimation and budgeting
4. Load testing and capacity planning tools
5. Provider-specific performance optimization
6. Real-time health dashboard

## Glossary

| Term | Definition |
|------|-----------|
| **Provider** | LLM service (Anthropic, OpenAI, etc.) |
| **Gateway** | Unified abstraction layer |
| **Router** | Strategy for selecting providers |
| **Resilience** | Fault tolerance mechanisms (circuit breaker, retry, fallback) |
| **Telemetry** | Observability data (traces, metrics) |
| **Capability** | Feature support (streaming, tools, vision) |
