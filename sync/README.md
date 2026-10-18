# UniPOS sync — keeping the Atlas and the Living ERD current

Pages:
- System Atlas: https://claude.ai/artifact/J1ojWaAaKu9scBELETi8XT → level **7 · Sync**
- Living ERD: https://claude.ai/artifact/FQvTjhc7gQTpodBGgL6YnG → banner on the home page

## What a refresh does
1. `git fetch origin dev` in every repo (17 services + frontend). Only remote refs change; **working copies and
   checked-out branches are never touched**.
2. Reads every repo from `origin/dev` (not your local branch) and rebuilds the Atlas data and the ERD data.
3. Compares with the previous refresh: new commits, tables/columns, GraphQL operations, service calls, Kafka.
4. Checks the Atlas's hand-written facts (`atlas-src/facts.json`) against the code: services, ports, JWT
   verification, call matrix, wrong-port URLs, Kafka listeners/topics, Kafka address typos. Services with new
   commits are listed for a findings re-check.
5. Writes `status.json`, `reports/<date>.md`, and a log in `logs/`.

## Run it
```
_unipos-study/sync/refresh.sh               # normal (needs the office network / VPN to reach GitLab)
_unipos-study/sync/refresh.sh --no-fetch    # rebuild from what was fetched last time
_unipos-study/sync/refresh.sh --print-cron  # weekday 09:30 timer: prints the line and the install command
```

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
"To review" item, re-runs `refresh.sh --no-fetch`, republishes both pages to the same links, and writes
`published.json`. The ERD's shared notes and proposals are not affected.
