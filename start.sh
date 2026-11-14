#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="/opt/homebrew/bin:$PATH"
export MPLCONFIGDIR="/tmp/astra-mpl"
mkdir -p "$MPLCONFIGDIR"

echo "============================================================"
echo "  ASTRA — Autonomous Spaceflight Health Intelligence"
echo "  Mode: LOCAL / OFFLINE-FIRST (No Docker)"
echo "============================================================"

cleanup() {
  echo ""
  echo "[ASTRA] Shutting down local services..."
  if [[ -n "${BACKEND_PID:-}" ]]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  exit 0
}
trap cleanup INT TERM

echo "[1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ..."
cd "$ROOT_DIR/backend"
"$ROOT_DIR/backend/.venv/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "[2/2] Starting Next.js Frontend on http://127.0.0.1:3000 ..."
cd "$ROOT_DIR/frontend"
npm run start -- --hostname 127.0.0.1 --port 3000 &
FRONTEND_PID=$!

echo ""
echo "  Frontend: http://127.0.0.1:3000"
echo "  API Docs: http://127.0.0.1:8000/docs"
echo "  Press Ctrl+C to stop both services."
echo ""

wait "$BACKEND_PID" "$FRONTEND_PID"
