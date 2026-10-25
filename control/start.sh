#!/usr/bin/env bash
# UniPOS Control Panel
#   ./start.sh          start the server (if not running) and open http://127.0.0.1:8770/
#   ./start.sh stop     stop the server
#   ./start.sh dry      restart in dry-run mode (deploy only echoes what it would run)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${CONTROL_PORT:-8770}"
URL="http://127.0.0.1:$PORT/"
mkdir -p "$HERE/runs"
PIDF="$HERE/runs/server.pid"

running() { [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; }
stop() { running && kill "$(cat "$PIDF")" && echo "stopped"; rm -f "$PIDF"; }

case "${1:-}" in
  stop) stop; exit 0 ;;
  dry)  stop; export CONTROL_DRY_RUN=1 ;;
esac

if ! running; then
  nohup python3 -I "$HERE/server.py" >>"$HERE/runs/server.log" 2>&1 &
  echo $! >"$PIDF"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -s -o /dev/null "$URL" && break
    sleep 0.3
  done
  running || { echo "server did not start; see $HERE/runs/server.log"; exit 1; }
  echo "started on $URL${CONTROL_DRY_RUN:+ (dry run)}"
else
  echo "already running on $URL"
fi
xdg-open "$URL" >/dev/null 2>&1 &
