# UniPOS Control Panel

A local site that gives buttons for the everyday scripts and shows their results.

```bash
cd ~/Downloads/projects/_unipos-study/control
./start.sh          # starts the server and opens http://127.0.0.1:8770/
./start.sh stop     # stops it
./start.sh dry      # restart with Deploy in dry-run mode (prints, does nothing)
```

Needs only `python3` (standard library). Only this PC can open it: the server listens on `127.0.0.1`.

## Pages

| Page | Button runs | Changes anything? |
|---|---|---|
| Home | nothing (local `git` reads only) | no |
| Pull | `projects/pull-all.sh` (`git pull --ff-only` per repo) | yes, fast-forwards working copies; never merges or overwrites |
| Status | `git fetch` per repo, then `projects/status-all.sh`; adds a "↓ Not pulled" group | no (fetch updates remote refs only) |
| Deploy | `projects/deploy-script/deploy <dev\|demo> <service>` | **yes, the dev/demo server**: build → upload → terraform destroy → apply → restart Apollo |
| Study | `_unipos-study/sync/refresh.sh` (with or without `--no-fetch`) | only `git fetch` + the study files |
| History | nothing | no |

Also: `/atlas` and `/erd` serve the local Atlas and Living ERD.

## Deploy safety
- Choose env + service → **Pre-check** shows the branch, commit, how far behind origin, and uncommitted files (which *will* be deployed, since the build uses your local folder).
- Type the service name to enable the button. If the service's commit changes after the pre-check, the deploy is refused.
- One job at a time. Pull/Status/Refresh can be cancelled. A deploy has an **Emergency stop** (click twice within 5 s): it kills the local deploy at once, but commands already sent to the server may finish or be left half-done, so the service can be down until you deploy again.

## Safety of the server itself
- The browser sends only an action name; the commands are fixed in `server.py`.
- Requests must come with `Host: 127.0.0.1:8770` or `localhost:8770`, and every POST needs a random token created at each start (so another website can't press a button).
- It never reads `deploy-script/*.env`, `credentials.txt` or `DB credentials*`. Log lines that look like `password=…`, `token: …` are masked.

## Files
- `server.py`: server, API, job runner
- `web/`: the pages (`app.css`, `app.js` shared)
- `runs/`: one `<id>.log` per run, `history.json` (last 200), `server.log`, `server.pid`

## Optional: app-menu launcher
```bash
cat > ~/.local/share/applications/unipos-control.desktop <<EOF
[Desktop Entry]
Type=Application
Name=UniPOS Control
Exec=$HOME/Downloads/projects/_unipos-study/control/start.sh
Terminal=false
Icon=utilities-terminal
EOF
```
