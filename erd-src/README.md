# UniPOS Living ERD — source

Live page: https://claude.ai/artifact/FQvTjhc7gQTpodBGgL6YnG (private; share from the page's Share menu)

**Code is the source of truth.** Tables, columns, keys and relations are read from each service's `@Entity`
classes (working tree on `dev`; compliance and notification from `origin/dev`). The PDF ERDs are not used.

## Files
| File | What |
|---|---|
| `extract.py` | reads the repos (read-only) → `raw.json` |
| `build.py` | resolves references by column name, writes `out/` (page + one data file per service), `dbml/` (one DBML file per service + `_all-services.dbml`) and a dated snapshot in `snapshots/` |
| `erd-core.js` | shared: Java→SQL types, DBML / PostgreSQL / Mermaid generators (used by build and page) |
| `app.js`, `page.html` | the interactive page |
| `dbml/<service>.dbml` | plain-text ERD per service; paste into dbdiagram.io to view/edit |

## When the code changes
```
cd _unipos-study/erd-src
python3 -I extract.py && python3 -I build.py
```
Then ask Claude to republish `out/index.html` with the `out/data/*.json` files to the same link.
The page's "Changes" panel lists tables/columns added, removed or retyped since the previous snapshot.
Notes, statuses, proposals and layouts live in the page's shared database and stay attached by
`service~table~column`; anything whose target disappeared is listed as an orphaned note.

## When the design changes before the code
Use "Propose a change" in the page (new table / column / reference). Proposals show dashed in purple and are
included in exports. Mark them done once the code has them.
