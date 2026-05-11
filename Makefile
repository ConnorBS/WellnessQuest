.PHONY: dev down build test test-backend test-frontend lint typecheck \
        migrate migrate-new seed psql logs backend-shell frontend-shell e2e clean

COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_CI  := docker compose -f docker-compose.yml -f docker-compose.ci.yml

dev:
	$(COMPOSE_DEV) up --build

down:
	$(COMPOSE_DEV) down

build:
	docker compose build

logs:
	$(COMPOSE_DEV) logs -f --tail=200

# --- Backend
backend-shell:
	$(COMPOSE_DEV) exec backend bash

migrate:
	$(COMPOSE_DEV) exec backend alembic upgrade head

migrate-new:
	@test -n "$(msg)" || (echo "usage: make migrate-new msg=\"your message\""; exit 1)
	$(COMPOSE_DEV) exec backend alembic revision --autogenerate -m "$(msg)"

seed:
	$(COMPOSE_DEV) exec backend python -m app.db.seed

psql:
	$(COMPOSE_DEV) exec postgres psql -U $${POSTGRES_USER:-wq} -d $${POSTGRES_DB:-wellnessquest}

test-backend:
	$(COMPOSE_DEV) exec backend pytest -q

lint-backend:
	$(COMPOSE_DEV) exec backend ruff check .
	$(COMPOSE_DEV) exec backend mypy app

# --- Frontend
frontend-shell:
	$(COMPOSE_DEV) exec frontend sh

test-frontend:
	$(COMPOSE_DEV) exec frontend pnpm test

lint-frontend:
	$(COMPOSE_DEV) exec frontend pnpm lint
	$(COMPOSE_DEV) exec frontend pnpm typecheck

# --- Combined
test: test-backend test-frontend

lint: lint-backend lint-frontend

typecheck: lint

e2e:
	$(COMPOSE_CI) up -d --build
	$(COMPOSE_CI) exec frontend pnpm exec playwright test
	$(COMPOSE_CI) down

clean:
	$(COMPOSE_DEV) down -v
	rm -rf backups
