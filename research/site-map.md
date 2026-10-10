# ClusterOne — Site Map

**Target:** the ClusterOne console
**Audit date:** 10 Oct 2026
**Account used:** "Reyad", role `User · default` (non-admin). No admin account was used.

## How the evidence was collected

The audit sandbox could not reach the site directly: its outbound proxy refused the connection with HTTP 403. A plain HTTP fetch returned only an empty HTML shell with the title "ClusterOne", which means the UI is rendered client-side by JavaScript.

All page evidence therefore came from the project owner's own signed-in browser:
- 6 screenshots (5 used; one was a duplicate crop of the API-keys page).
- Copied page text from 5 pages: Overview, Nodes, Showcase, Mounted GPUs and Guide.

Status legend:
- **Inspected** — a screenshot and/or the full page text is on file.
- **Linked only** — the route is known from navigation links, but its content was not captured.

## Global layout (every page)

- **Left sidebar:** the C1 logo with "ClusterOne · GPU cluster console", the navigation groups, a "Cluster healthy" summary card (cores · GPUs · RAM), and the user card (name, role, sign-out button).
- **Top bar:** a sidebar-collapse button, a breadcrumb (`ClusterOne > Page`), a "Live · updated Ns ago" indicator and a primary **Submit job** button.

## Navigation tree

| Group | Page | Route | Status |
|---|---|---|---|
| Main | Overview | `/` | Inspected (01 + text) |
| Main | Cluster map | `/cluster` | Inspected (02) |
| Main | Nodes (badge `5/7`) | `/nodes` | Inspected (03 + text) |
| Main | ↳ Node detail | `/nodes/{32-hex id}` (7 IDs seen) | Linked only |
| Main | My jobs | `/jobs` | Linked only |
| Main | Submit job | `/submit` | Linked only |
| Main | Workspaces | `/workspaces` | Linked only |
| Main | My files | `/files` | Linked only |
| Main | LLM Playground | `/playground` | Inspected (04) |
| Main | Mounted GPUs | `/mounts` | Inspected (text) |
| Main | Environments | `/environments` | Linked only (environment list visible in Guide) |
| Help | Showcase | `/showcase` | Inspected (text) |
| Help | Guide | `/guide` | Inspected (text) |
| Help | My account | `/account` | Linked only |
| Administration | Wall display | `/wall` | Linked only |
| (not in sidebar) | API keys | `/api-keys` | Inspected: **Restricted** for this role (05) |

## Other URLs referenced by the pages

- `/install/clusterone-sdk.zip` — the pip-installable SDK/CLI (Guide, Mounted GPUs).
- `/api/v1/...` — the REST API (full endpoint list in the Guide; see `architecture-notes.md`).
- Guide sub-sections: Getting started, How it works, What the cluster offers now, Resource planner, Recipes (10), Writing code, Job statuses & exit codes, Several PCs at once, Terminal & Python SDK, Automate with the API, Your limits & fair share, Environments & datasets, Troubleshooting (13), Glossary.
- Showcase sections: What we built, How it works, Smart scheduling, Pool GPU memory, Speed-up, Features, Use cases, Access control, Ways to use, Architecture, Limits & next.

## Counts

- **Pages in navigation:** 15, plus `/api-keys` and per-node detail pages.
- **Inspected:** 8 pages (Overview, Cluster map, Nodes, LLM Playground, Mounted GPUs, Showcase, Guide, API keys).
- **Linked only:** 8 pages (My jobs, Submit job, Workspaces, My files, Environments, My account, Wall display, Node detail).
