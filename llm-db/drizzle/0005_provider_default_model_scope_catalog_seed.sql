ALTER TABLE "providers" ADD COLUMN "default_model" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "scope" text DEFAULT 'org' NOT NULL;--> statement-breakpoint
INSERT INTO "provider_catalogs" ("name", "host", "models") VALUES
  ('openai', 'https://api.openai.com', '["gpt-5","gpt-4o","gpt-4o-mini","o3-mini","o1"]'::jsonb),
  ('anthropic', 'https://api.anthropic.com', '["claude-opus-4","claude-sonnet-4","claude-haiku-4"]'::jsonb),
  ('google', 'https://generativelanguage.googleapis.com', '["gemini-2.5-pro","gemini-2.5-flash","gemini-2.0-flash"]'::jsonb),
  ('minimax', 'https://api.minimax.io', '["abab6.5","abab6.5-chat"]'::jsonb),
  ('ollama', 'http://localhost:11434', '["ollama/gemma3:4b","ollama/llama3.1:8b","ollama/qwen2.5:7b","ollama/mistral:7b"]'::jsonb),
  ('azure-openai', '', '[]'::jsonb),
  ('custom', '', '[]'::jsonb)
ON CONFLICT ("name") DO NOTHING;
