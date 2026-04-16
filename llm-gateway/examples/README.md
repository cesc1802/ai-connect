# LLM Gateway Examples

Runnable examples demonstrating llm-gateway usage.

## Prerequisites

```bash
# Install dependencies
cd llm-gateway && npm install

# For Ollama (local LLM - optional)
brew install ollama
ollama serve
ollama pull llama3.2
```

## Running Examples

All examples use `tsx` to run TypeScript directly:

```bash
# Provider examples - direct provider usage
ANTHROPIC_API_KEY=sk-... npx tsx examples/anthropic-example.ts
OPENAI_API_KEY=sk-... npx tsx examples/openai-example.ts
npx tsx examples/ollama-example.ts  # No API key needed, requires local Ollama
MINIMAX_API_KEY=... MINIMAX_GROUP_ID=... npx tsx examples/minimax-example.ts

# Gateway examples - unified API
ANTHROPIC_API_KEY=sk-... npx tsx examples/gateway-basic.ts
ANTHROPIC_API_KEY=sk-... npx tsx examples/gateway-streaming.ts
ANTHROPIC_API_KEY=sk-... npx tsx examples/gateway-tools.ts
ANTHROPIC_API_KEY=sk-... OPENAI_API_KEY=sk-... npx tsx examples/gateway-fallback.ts
```

## Examples Overview

| File | Description |
|------|-------------|
| `anthropic-example.ts` | Direct Anthropic Claude API usage |
| `openai-example.ts` | Direct OpenAI GPT API usage |
| `ollama-example.ts` | Local Ollama inference (no API key) |
| `minimax-example.ts` | MiniMax API usage (China-based) |
| `gateway-basic.ts` | Gateway unified API basics |
| `gateway-streaming.ts` | Streaming responses through gateway |
| `gateway-tools.ts` | Tool/function calling with gateway |
| `gateway-fallback.ts` | Automatic provider failover |

## Environment Variables

| Variable | Provider | Required |
|----------|----------|----------|
| `ANTHROPIC_API_KEY` | Anthropic | For Anthropic/gateway examples |
| `OPENAI_API_KEY` | OpenAI | For OpenAI/fallback examples |
| `MINIMAX_API_KEY` | MiniMax | For MiniMax examples |
| `MINIMAX_GROUP_ID` | MiniMax | For MiniMax examples |

## Security Note

Examples use environment variables for credentials - never hardcode API keys in source files.
