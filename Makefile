# ai-connect dev Makefile
# Starts the llm-http server and the llm-ui frontend via pnpm workspace filters.

# Use pnpm path filters so targets work by directory (unambiguous vs package name).
PNPM        := pnpm
HTTP_FILTER := --filter ./llm-http
UI_FILTER   := --filter ./llm-ui

.DEFAULT_GOAL := dev
.PHONY: dev http ui install build help

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  %-10s %s\n", $$1, $$2}'

install: ## Install all workspace dependencies
	$(PNPM) install

http: ## Start only the llm-http server (watch mode)
	$(PNPM) $(HTTP_FILTER) dev

ui: ## Start only the llm-ui frontend (Vite dev server)
	$(PNPM) $(UI_FILTER) dev

dev: ## Start llm-http and llm-ui together; Ctrl-C stops both
	@echo "Starting llm-http + llm-ui (Ctrl-C to stop both)..."
	@trap 'kill 0' INT TERM EXIT; \
	$(PNPM) $(HTTP_FILTER) dev & \
	$(PNPM) $(UI_FILTER) dev & \
	wait

build: ## Build both packages
	$(PNPM) $(HTTP_FILTER) build
	$(PNPM) $(UI_FILTER) build
