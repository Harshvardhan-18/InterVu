# InterVu developer commands. Run `make help` for the list.
# Assumes macOS/Linux (virtualenv binaries under .venv/bin).

PYTHON ?= python3.11

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
ADMIN_DIR    := intervu-admin

BACKEND_PY := .venv/bin/python
ADMIN_PY   := .venv/bin/python

.DEFAULT_GOAL := help

.PHONY: help setup setup-backend setup-frontend setup-admin backend-env \
        backend frontend admin \
        test test-backend lint lint-frontend lint-backend check-admin \
        db-up db-down up down migrate migration

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s\n", $$1, $$2}'

# ── Setup ─────────────────────────────────────────────────────────────────────

setup: setup-backend setup-frontend setup-admin ## Install every component's dependencies

setup-backend: ## Create backend/.venv, install backend + test deps, create backend/.env
	cd $(BACKEND_DIR) && $(PYTHON) -m venv .venv && $(BACKEND_PY) -m pip install --upgrade pip && $(BACKEND_PY) -m pip install -r requirements.txt -r requirements-dev.txt
	@$(MAKE) --no-print-directory backend-env

# Creates backend/.env from .env.example when it is missing and fills a blank
# AUTH_SECRET with a random value. Never overwrites an existing secret.
backend-env: ## Create backend/.env (if missing) and generate AUTH_SECRET when blank
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env && chmod 600 $(BACKEND_DIR)/.env && \
		echo "Created backend/.env from backend/.env.example (fill in your API keys)."; \
	fi
	@if grep -qE '^AUTH_SECRET=[[:space:]]*$$' $(BACKEND_DIR)/.env; then \
		secret=$$(python3 -c "import secrets;print(secrets.token_urlsafe(48))") && \
		awk -v s="$$secret" '/^AUTH_SECRET=[[:space:]]*$$/ { print "AUTH_SECRET=" s; next } { print }' \
			$(BACKEND_DIR)/.env > $(BACKEND_DIR)/.env.tmp && \
		mv $(BACKEND_DIR)/.env.tmp $(BACKEND_DIR)/.env && chmod 600 $(BACKEND_DIR)/.env && \
		echo "Generated AUTH_SECRET in backend/.env."; \
	fi
	@grep -qE '^ENV=' $(BACKEND_DIR)/.env || \
		echo "Warning: backend/.env has no ENV line. Unset ENV is treated as production; add ENV=development for local work."

setup-frontend: ## Install frontend dependencies from package-lock.json
	cd $(FRONTEND_DIR) && npm ci

setup-admin: ## Create intervu-admin/.venv and install admin dependencies
	cd $(ADMIN_DIR) && $(PYTHON) -m venv .venv && $(ADMIN_PY) -m pip install --upgrade pip && $(ADMIN_PY) -m pip install -r requirements.txt

# ── Run (all bound to 127.0.0.1) ──────────────────────────────────────────────

backend: backend-env ## Run the FastAPI backend on http://127.0.0.1:8000 (needs db-up; creates/checks backend/.env)
	cd $(BACKEND_DIR) && $(BACKEND_PY) -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

frontend: ## Run the Next.js dev server on http://127.0.0.1:3000
	cd $(FRONTEND_DIR) && npm run dev

admin: ## Run the Django admin on http://127.0.0.1:8002
	cd $(ADMIN_DIR) && $(ADMIN_PY) manage.py runserver 127.0.0.1:8002

# ── Quality ───────────────────────────────────────────────────────────────────

test: test-backend ## Run all automated tests

test-backend: ## Run the backend pytest suite (mocked LLMs/DB, no keys needed)
	cd $(BACKEND_DIR) && ENV=test $(BACKEND_PY) -m pytest -q

lint: lint-backend lint-frontend check-admin ## Static checks for every component

lint-backend: ## Byte-compile the backend to catch syntax errors
	$(BACKEND_DIR)/$(BACKEND_PY) -m compileall -q $(BACKEND_DIR) -x '(\.venv|chroma_db)'

lint-frontend: ## ESLint, production build, then TypeScript type check
	cd $(FRONTEND_DIR) && npm run lint && npm run build && npx tsc --noEmit

check-admin: ## Django system checks for intervu-admin
	cd $(ADMIN_DIR) && DJANGO_DEBUG=True $(ADMIN_PY) manage.py check

# ── Database migrations ───────────────────────────────────────────────────────

migrate: ## Apply database migrations (alembic upgrade head) to DATABASE_URL
	cd $(BACKEND_DIR) && $(BACKEND_PY) -m alembic upgrade head

migration: ## Create a migration from model changes: make migration m="add column"
	@test -n "$(m)" || (echo 'Usage: make migration m="what changed"'; exit 1)
	cd $(BACKEND_DIR) && $(BACKEND_PY) -m alembic revision --autogenerate -m "$(m)"

# ── Database / containers ─────────────────────────────────────────────────────

db-up: ## Start Postgres (127.0.0.1:5432); needs POSTGRES_PASSWORD in ./.env
	docker compose up -d postgres

db-down: ## Stop the compose stack (data volume is kept)
	docker compose down

up: backend-env ## Build and start postgres + backend + frontend containers
	docker compose --profile app up -d --build

down: ## Stop every compose service, including the app profile
	docker compose --profile app down
