.PHONY: install backend frontend build test lint

# One-time setup: Python venv + backend deps, frontend deps, and a local .env
install:
	cd backend && python3 -m venv venv && venv/bin/python -m pip install -r requirements-dev.txt
	cd backend && [ -f .env ] || cp .env.example .env
	cd frontend && npm install

# API on http://localhost:8000 (docs at /docs)
backend:
	cd backend && venv/bin/python -m uvicorn app.main:app --reload --port 8000

# UI on http://localhost:5173 (proxies /api to the backend)
frontend:
	cd frontend && npm run dev

build:
	cd frontend && npm run build

# Same checks CI runs
test:
	cd backend && venv/bin/python -m pytest
	cd frontend && npm test

lint:
	cd backend && venv/bin/python -m ruff check .
	cd frontend && npm run lint
