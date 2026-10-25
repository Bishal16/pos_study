#!/usr/bin/env bash
# UniPOS daily refresh. Read-only for the repos: only `git fetch` (remote refs) + reading origin/dev.
#   ./refresh.sh               fetch, rebuild Atlas + Living ERD data, write sync/reports/<date>.md
#   ./refresh.sh --no-fetch    same, without contacting GitLab
#   ./refresh.sh --auto        timer mode: skip if today already had a successful fetch
#   ./refresh.sh --print-cron  show the crontab line (every 30 min, 09:00-17:30, every day) and how to install it
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ "${1:-}" = "--print-cron" ]; then
  # tries every half hour of the working day, so a late boot or a VPN that comes up later still gets one run;
  # --auto makes every try after the first successful one a no-op
  LINE="*/30 9-17 * * * DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus $HERE/refresh.sh --auto"
  echo "Crontab line:"
  echo "  $LINE"
  echo "Install it (replaces any older refresh.sh line, keeps the rest of your crontab):"
  echo "  ( crontab -l 2>/dev/null | grep -v '_unipos-study/sync/refresh.sh'; echo \"$LINE\" ) | crontab -"
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
