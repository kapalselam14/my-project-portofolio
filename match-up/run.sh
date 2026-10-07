#!/usr/bin/env bash
#
# MatchUp — unified local development runner.
# Starts the API, admin web, and optionally the mobile app in one terminal
# using background processes and tails their logs.
#
# Usage:
#   ./run.sh          # start API + admin web (+ mobile if a device is available)
#   ./run.sh mobile   # start API + admin web + mobile (requires emulator/device)
#   ./run.sh web      # start API + admin web only
#   ./run.sh stop     # stop all run.sh background processes
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$ROOT_DIR/apps/api-server"
WEB_DIR="$ROOT_DIR/apps/admin-web"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
LOG_DIR="$ROOT_DIR/.logs"
PID_DIR="$ROOT_DIR/.pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

API_LOG="$LOG_DIR/api.log"
WEB_LOG="$LOG_DIR/admin-web.log"
MOBILE_LOG="$LOG_DIR/mobile.log"
API_PID="$PID_DIR/api.pid"
WEB_PID="$PID_DIR/admin-web.pid"
MOBILE_PID="$PID_DIR/mobile.pid"

stop_all() {
  echo "Stopping MatchUp services..."
  for pid_file in "$PID_DIR"/*.pid; do
    if [[ -f "$pid_file" ]]; then
      pid=$(cat "$pid_file")
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
      fi
      rm -f "$pid_file"
    fi
  done
  # Also kill any lingering dev-server processes on known ports
  lsof -ti:4000 | xargs kill -9 2>/dev/null || true
  lsof -ti:5173 | xargs kill -9 2>/dev/null || true
  echo "All services stopped."
}

trap stop_all SIGINT SIGTERM

if [[ "${1:-}" == "stop" ]]; then
  stop_all
  exit 0
fi

run_with_log() {
  local name="$1"
  local dir="$2"
  local log_file="$3"
  local pid_file="$4"
  shift 4

  echo "[$name] starting in $dir..."
  (
    cd "$dir" && "$@" >"$log_file" 2>&1
  ) &
  local pid=$!
  echo "$pid" >"$pid_file"
}

run_with_log "api" "$API_DIR" "$API_LOG" "$API_PID" npm run dev
run_with_log "admin-web" "$WEB_DIR" "$WEB_LOG" "$WEB_PID" npm run dev

start_mobile() {
  if ! command -v flutter >/dev/null 2>&1; then
    echo "[mobile] flutter not found; skipping mobile."
    return
  fi

  if [[ "${1:-}" != "force" ]]; then
    # Check for an available mobile device (android or ios).
    local device_count
    device_count=$(flutter devices --machine 2>/dev/null | grep -c '"targetPlatform": "android\|"targetPlatform": "ios' || true)
    if [[ "$device_count" -eq 0 ]]; then
      echo "[mobile] no Android/iOS device detected; start an emulator/device and re-run, or use: ./run.sh mobile"
      return
    fi
  fi

  run_with_log "mobile" "$MOBILE_DIR" "$MOBILE_LOG" "$MOBILE_PID" flutter run
}

mode="${1:-}"
case "$mode" in
  mobile)
    start_mobile force
    ;;
  web)
    # API + admin web only
    ;;
  *)
    start_mobile
    ;;
esac

echo ""
echo "All requested services are starting. Logs:"
echo "  API:       tail -f $API_LOG"
echo "  Admin web: tail -f $WEB_LOG"
if [[ -f "$MOBILE_PID" ]]; then
  echo "  Mobile:    tail -f $MOBILE_LOG"
fi
echo ""
echo "Stop everything with: ./run.sh stop"
echo ""

# Stream all logs in this terminal
if command -v tail >/dev/null 2>&1; then
  logs=("$API_LOG" "$WEB_LOG")
  if [[ -f "$MOBILE_PID" ]]; then
    logs+=("$MOBILE_LOG")
  fi
  tail -f "${logs[@]}"
fi
