# ClusterOne — Architecture Notes

Every statement below carries one of these evidence levels:

- **[C] Confirmed.** Directly visible in the UI or stated as fact on the site (Showcase "Architecture", Guide, Cluster map).
- **[I] Inference.** A reasonable conclusion from observable signals. Not stated by the site.
- **[T] Team-stated.** From the ClusterOne team's own project notes. Not observable on the live site, and it may differ from the production deployment.
- **[U] Unknown.** No evidence either way.

## 1. Topology

| Component | Finding | Level | Source |
|---|---|---|---|
| Master | A cloud server at `ClusterOne console`, served over HTTPS. It runs the web console, REST API, RBAC & quotas, scheduler & fair-share queue, gang dispatcher, live monitoring, audit and auto-healing. It does not run jobs. | C | Showcase "Architecture"; Guide glossary "Master" |
| Edge | Behind Cloudflare with HTTPS. | C | Showcase "Cloud master" |
| Nodes | Ordinary lab Windows PCs, each running a node agent. 7 registered; 5 online in most captures. | C | Showcase; Nodes page ("Windows · N cores") |
| Agent connectivity | Outbound connections only, so no port forwarding is needed behind routers. | C | Showcase |
| Agent duties | Reports GPU health, builds environments, applies firewall rules, upgrades itself; agents rejoin on their own after a master restart (claimed 108 s). | C (claimed) | Showcase |
| Lab LAN | 1 Gbps. PCs exchange gradients directly in multi-PC jobs. One PC is on a 10 Mbps link. Guide flags raihan and Reyad PC as "slow link". | C | Showcase limits; Guide multi-PC table |
| Cluster mesh | A private overlay network so PCs outside the lab can reach lab PCs (`clusterone mesh join`, admin only). | C (existence); U (technology) | Mounted GPUs manual |
| Peer-group detection | Agents test direct reachability every 15 minutes; PCs on different networks form separate groups. | C | Guide "Several PCs at once" |

## 2. Front end

| Finding | Level | Source |
|---|---|---|
| A single-page app rendered client-side: the fetched HTML is an empty shell titled "ClusterOne", and all content appears only after JavaScript runs. | I (strong) | Raw fetch result |
| Routes: `/`, `/cluster`, `/nodes`, `/nodes/{id}`, `/jobs`, `/submit`, `/workspaces`, `/files`, `/playground`, `/mounts`, `/environments`, `/showcase`, `/guide`, `/account`, `/wall`, `/api-keys`. | C | Sidebar links, URL bar |
| Live updates every ~1 s ("Live · updated 0s ago"). The transport (polling, SSE or WebSocket) was not observed. `GET /api/v1/cluster/live` returns "everything the dashboard shows, in one call", which suggests polling. | C (refresh); I (polling) | Top bar; Guide endpoint table |
| UI framework, bundler and component library. | U | No bundle was inspected |

## 3. Back end / API

| Finding | Level | Source |
|---|---|---|
| Versioned REST API at `/api/v1`: `auth/me`, `auth/me/usage`, `jobs` (list, create, get, log, outputs, cancel, hold/release), `environments`, `datasets`, `nodes`, `cluster/live`. | C | Guide "Endpoints" table |
| Job submission is multipart: a `spec` JSON plus an optional source zip and requirements file. | C | Guide |
| Errors are returned as `{"detail": "…"}` with HTTP 400/401/403/429. | C | Guide |
| `{"detail": …}` is FastAPI's default error shape, consistent with a FastAPI back end. | I | Error format |
| The back end is FastAPI (Python) with PostgreSQL via `asyncpg`; the planned schema includes `users`, `nodes`, `gpus`, `jobs`, `job_logs`, `distributed_jobs`, `node_assignments`. | T | Team project notes |
| "The database and queue are backed up before every update." | C | Showcase |
| Version shown: **ClusterOne 0.1.0**. | C | Cluster map master panel |

## 4. Scheduling and execution

| Finding | Level | Source |
|---|---|---|
| The scheduler is described as an "industry-standard high-throughput scheduler (used at CERN and in university grids), tuned for desktop GPUs". | C (description) | Showcase |
| That scheduler is likely **HTCondor**: the description matches it, and the job-state vocabulary in the API client (`idle`, `held`, `suspended`, `transferring`) matches HTCondor's states. The site does not name it. | I | Showcase + Guide code sample |
| Fair-share queue: groups take turns in proportion to their weight, heavy recent users wait slightly longer, and idle capacity is always used. | C | Guide |
| Gang scheduling: all PCs of a multi-PC job start within the same second, or none do. | C (claimed) | Showcase |
| Availability policy per node, `always` or `idle` ("when idle"). The scheduler avoids PCs someone is using. | C | Nodes cards, Playground, Showcase |
| Isolation: each job runs in a throw-away low-privilege account and sees only its own GPU (`CUDA_VISIBLE_DEVICES`). | C | Showcase, Guide env vars |
| Distributed training: `clusterone_dist` helper with DDP (fp16 compression, `no_sync` accumulation) and GPipe-style pipeline parallelism. Uses the Gloo backend on Windows; NCCL, FSDP and ZeRO-3 are not available. | C | Guide, Showcase |
| Automatic restart of a job on another node if its PC switches off. | C (claimed) | Guide "How it works" |

## 5. LLM serving

| Finding | Level | Source |
|---|---|---|
| The Playground splits model layers across the selected PCs' GPUs. It lists 177 GGUF models (e.g. Qwen3 8B Q4_K_M), estimates the memory fit, and gives a ready-time estimate. | C | 04 |
| Mounted GPUs: the user's PC runs llama.cpp locally and borrows lab GPUs as remote backends (`--rpc`). It serves an OpenAI-compatible API on `127.0.0.1:8080/v1`. Mounts auto-release 5 minutes after the client goes quiet and are audit-logged. | C | Mounted GPUs manual |
| How the Playground serves its model (llama.cpp RPC like Mounts, or something else). | U | Not shown |

## 6. Identity and governance

| Finding | Level | Source |
|---|---|---|
| Five built-in roles (Administrator, Operator, User, API client, Viewer), plus custom roles and per-person grant/deny. | C | Showcase "Access control" |
| Permissions are checked server-side for every page, button and API call. | C (claimed) | Showcase |
| The UI enforces permissions: `/api-keys` is blocked for `User · default`. | C | 05 |
| Quotas per user, group or API key: active jobs, GPUs/job, time limit, GPU-hours/month, storage, workspaces, mounts, allowed envs and nodes. | C | Guide limits table |
| API keys: prefix `c1u_`, sent as Bearer or `X-API-Key`; scoped, with expiry, IP allow-list and rate limit. | C | Guide, Showcase |
| Audit log covering submissions and mounts. | C | Guide, Mounts manual |
| Sign-in mechanism for the web console (password, SSO, OAuth). | U | Login page not captured |

## 7. Storage and workspaces

| Finding | Level | Source |
|---|---|---|
| Job outputs are returned as `outputs.zip` from `CLUSTERONE_OUTPUT_DIR`. | C | Guide |
| Shared datasets are cached on nodes once and read from `CLUSTERONE_DATASET_DIR`. | C | Guide |
| Personal storage (My files, default 20 GB) and JupyterLab / VS Code workspaces exist. | C (existence) | Guide quotas |
| Where files physically live (on the master, on nodes, in object storage). | U | — |

## Summary

- **Confirmed / claimed:** web SPA + REST master in the cloud behind Cloudflare; outbound-only Windows node agents; fair-share and gang scheduling; RBAC + quotas + scoped API keys; DDP and pipeline training over a 1 Gbps LAN; llama.cpp-based GPU lending.
- **Inferred:** FastAPI (error shape, and team notes); HTCondor-style scheduler (state names and description); polling-based live dashboard.
- **Unknown:** front-end framework, live-update transport, mesh technology, console login method, storage back end, Playground serving engine.
