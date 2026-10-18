#!/usr/bin/env bash
# UniPOS daily refresh. Read-only for the repos: only `git fetch` (remote refs) + reading origin/dev.
#   ./refresh.sh               fetch, rebuild Atlas + Living ERD data, write sync/reports/<date>.md
#   ./refresh.sh --no-fetch    same, without contacting GitLab
#   ./refresh.sh --print-cron  show the crontab line (weekdays 09:30) and how to install it
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ "${1:-}" = "--print-cron" ]; then
  LINE="30 9 * * 1-5 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus $HERE/refresh.sh"
  echo "Crontab line:"
  echo "  $LINE"
  echo "Install it (keeps your existing crontab):"
  echo "  ( crontab -l 2>/dev/null; echo \"$LINE\" ) | crontab -"
  exit 0
fi
mkdir -p "$HERE/logs"
LOG="$HERE/logs/$(date +%F).log"
{
  echo "=== $(date '+%F %T') refresh $*"
  python3 -I "$HERE/refresh.py" "$@"
  echo "exit $?"
} >>"$LOG" 2>&1
tail -n 4 "$LOG"
