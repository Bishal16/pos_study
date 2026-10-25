# UniPOS sync — keeping the Atlas and the Living ERD current

Pages:
- System Atlas: https://claude.ai/artifact/J1ojWaAaKu9scBELETi8XT → level **7 · Sync**
- Living ERD: https://claude.ai/artifact/FQvTjhc7gQTpodBGgL6YnG → banner on the home page

## What a refresh does
1. `git fetch origin dev` in every repo (17 services + frontend). Only remote refs change; **working copies and
   checked-out branches are never touched**.
2. Reads every repo from `origin/dev` (not your local branch) and rebuilds the Atlas data and the ERD data.
3. Compares with the **last published build** (`state/published/`): new commits, tables/columns, GraphQL operations,
   service calls, Kafka. The list keeps growing until the pages are published again, so running the refresh
   several times a day never hides changes.
4. Checks the Atlas's hand-written facts (`atlas-src/facts.json`) against the code: services, ports, JWT
   verification, call matrix, wrong-port URLs, Kafka listeners/topics, Kafka address typos. Services with new
   commits are listed for a findings re-check.
5. Writes `status.json`, `reports/<date>.md`, and a log in `logs/`.

## Run it
```
_unipos-study/sync/refresh.sh               # normal (needs the office network / VPN to reach GitLab)
_unipos-study/sync/refresh.sh --no-fetch    # rebuild from what was fetched last time
_unipos-study/sync/refresh.sh --auto        # what the timer runs: skips if today already had a successful fetch
_unipos-study/sync/refresh.sh --print-cron  # prints the timer line and the install command
```
The timer tries every 30 minutes from 09:00 to 17:30, every day. The first try that reaches GitLab does the work;
later tries that day do nothing. So a PC switched on late, or a VPN that connects later, still gets its daily run.
cron cannot run while the PC is off, so days the PC is off are simply caught up by the next run (changes add up).

## How do I know it is in sync?
The Sync view (and the report) answers three questions:
| Check | Green when |
|---|---|
| Fresh | every repo was fetched successfully in the last refresh |
| No drift | "To review" is empty: the Atlas facts match the code |
| Published | the report says "already published" for the latest build |

Amber "built without fetching" / "could not reach GitLab" means the pages show code as of the last successful
fetch, with each repo's commit and date listed.

## Publishing (with Claude)
Say **"publish the refresh"**. Claude reads today's report, fixes the Atlas facts and study notes for every
"To review" item, re-runs `refresh.sh --no-fetch`, republishes both pages to the same links, then runs
`python3 -I sync/refresh.py --mark-published`, which writes `published.json` and makes this build the new baseline. The ERD's shared notes and proposals are not affected.
