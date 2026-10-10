# ClusterOne — Feature Inventory

Each feature has an ID (F01–F30), a description, what was observed, its evidence and a status. Statuses follow the audit brief: **Verified working**, **Partially working**, **Failed**, **Not tested**, **Restricted**.

"Showcase claim" marks a capability the site describes about itself that this audit did not independently reproduce.

## A. Monitoring

| ID | Feature | Observed behaviour | Evidence | Status |
|---|---|---|---|---|
| F01 | Overview KPI tiles | Seven tiles with sparklines: Nodes online (5/7, 2 offline), GPUs in use (0/5), CPU load (38% / 30% across two snapshots), Network, Memory in use (54 GB of 71 GB), Jobs running (0), Completed today (0). The values change between captures. | 01, Overview text | Verified working |
| F02 | Live indicator | Top bar shows "Live · updated 0–1s ago" on every captured page. | 01–05 | Verified working |
| F03 | Live cluster topology (Overview) | The master/scheduler card sits in the centre with 7 node cards around it. Each card shows OS, cores, RAM, CPU/RAM/GPU/NET bars and the GPU model. Offline nodes appear with red markers and dashed links. | 01 | Verified working |
| F04 | Live activity feed | A time-stamped event list: job submitted, dispatched, queued, started running, cancelled, removed. | 01, Overview text | Verified working (display) |
| F05 | Resource-utilisation and job-throughput charts | 30-minute CPU/GPU/RAM chart and Running/Queued chart. | Overview text only (below the fold) | Partially observed (text only, no screenshot) |
| F06 | Running now and pool capacity | "Nothing running" empty state with a Submit link; pool CPU/RAM/GPU/VRAM figures; quick links for all 7 nodes. | Overview text | Verified (display) |
| F07 | Cluster map | Full-page topology. The legend reads: jobs flowing, online/idle, draining, offline. The master panel shows host, web console, scheduler status Online, version **ClusterOne 0.1.0** and the queue. Also shows the "Working together" group (5 PCs · 28 GB) and an all-nodes list. | 02 | Verified working |
| F08 | Node hover tooltip | Hovering Reyad PC showed "Reyad PC (reyad) — online · Click for details". | 02 | Verified working |
| F09 | Node click-through to details | The tooltip promises details; Overview links to `/nodes/{id}`. | 02, Overview text | Not tested |
| F10 | Nodes grid | Seven cards with status pill, hostname, last seen, CPU/RAM/Net bars, GPU card (util, VRAM, °C, W, free/busy), availability policy (`always`/`idle`), ready environments and running count. Summary line: "5 of 7 online · 84 CPU cores · 71 GB RAM · 5 GPUs (28 GB VRAM)". | 03, Nodes text | Verified working |
| F11 | Nodes search and grid/list toggle | Controls are visible but were not exercised. | 03 | Not tested |
| F12 | Sidebar health card | Reads "Cluster healthy" with pooled totals. The totals change with node availability (84 cores/5 GPUs/71 GB in one capture, 64/4/63 in another). | 01, 05 | Verified working |
| F13 | Wall display | Admin-group link to `/wall`. | Sidebar | Not tested |

## B. Compute and jobs

| ID | Feature | Observed behaviour | Evidence | Status |
|---|---|---|---|---|
| F14 | Submit job (web form) | Linked from the top bar, Overview and Guide. The Guide documents code sources: write code, upload a zip, Git URL, shared dataset. | Guide text | Not tested (form not opened; submitting would consume cluster resources) |
| F15 | My jobs and job detail | Linked. The Guide documents the job statuses (Submitting → Queued → Running → Transferring → Completed/Failed/Timed out/Held/Cancelled) and exit codes 90–93. | Guide text | Not tested |
| F16 | Multi-PC jobs (DDP and pipeline) | Documented in the Guide and Showcase with the `clusterone_dist` helper. Guide shows group 1 with 5 PCs and 28 GB, and flags slow links on raihan and Reyad PC. | Guide, Showcase text | Not tested (Showcase claim: "verified on two PCs") |
| F17 | Environments | `base-sci`, `pytorch-cu128` (default) and `tensorflow`, each ready on 5 hosts. Every node card lists the same three. | Guide text, 03 | Verified (display) |
| F18 | Shared datasets | `imagenette2-320` (326 MB), cached on no node yet ("–"). | Guide text | Verified (display) |
| F19 | Workspaces (JupyterLab / VS Code) | Linked; quota rows mention "JupyterLab / VS Code workspaces". | Sidebar, Guide quotas | Not tested |
| F20 | My files (personal storage) | Linked; quota row "Personal storage (GB), default 20 GB". | Sidebar, Guide quotas | Not tested |
| F21 | Guide: resource planner | Turns defaults (small/medium NN, 1 GB) into: 1 GPU ≥ 4 GB, 4 cores, 9 GB RAM, 75 min, pytorch-cu128, and "Fits on JIhansPC, Rayat PC, ZAFOR PC, Reyad PC". | Guide text | Verified (computed output shown) |
| F22 | Guide: getting-started checklist | Shows "2 of 5 done" for this account. | Guide text | Verified (display) |
| F23 | Guide: limits and fair share table | Shows the account's quotas and where each comes from. Active jobs 4, GPUs/job 2 and time limit 1440 min come from group `default`; the rest are unlimited. | Guide text | Verified (display) |

## C. AI / LLM

| ID | Feature | Observed behaviour | Evidence | Status |
|---|---|---|---|---|
| F24 | LLM Playground: model picker | Selected Qwen3 8B (Q4_K_M, 4.68 GB, "not downloaded yet"), with tags Reasoning and Multilingual. "Browse 177 models" link. | 04 | Verified working (display + selection) |
| F25 | LLM Playground: PC selection and fit check | Offline PCs (ANAFS, Shafin) are greyed out; "raihan" is tagged "when idle". With 2 PCs selected (Rayat, ZAFOR): "11 GB GPU memory free" and "Fits: needs about 7.0 GB". Estimate shown: "Ready in ~3 min" (download ~2 min, spread < 1 min, load < 1 min). | 04 | Verified working |
| F26 | LLM Playground: generation settings | Presets Precise/Balanced/Creative; Temperature 0.7, Top-P 0.95, Max reply 1024 (context 8,192); Reasoning toggle; Reset. | 04 | Verified (display) |
| F27 | LLM Playground: Start session / Download ahead | Buttons visible; not pressed because starting would reserve GPUs on other people's PCs. | 04 | Not tested (deliberately) |
| F28 | Mounted GPUs | Live mounts (0), Refresh, and a 12-section user manual with a command builder. The builder's default output is `clusterone mount --gpus 2 --model qwen7b`, using llama.cpp RPC to borrow lab GPUs. | Mounts text | Verified (page display); mounting Not tested |

## D. Access and help

| ID | Feature | Observed behaviour | Evidence | Status |
|---|---|---|---|---|
| F29 | Role-based access (API keys page) | `/api-keys` as a `User · default` account shows "You don't have access to this page. Your role doesn't include the permission this page needs." | 05 | **Restricted** (permission check verified working) |
| F30 | Showcase page with interactive demos | Narrative page with measured numbers, a five-step job-lifecycle player, a scheduler simulator, a pipeline memory slider, a speed-up model, a role/permission explorer and an architecture section. | Showcase text | Content Verified; demo interactions Not tested |

Related documentation (not separate features): the CLI/SDK (`pip install …/install/clusterone-sdk.zip`, `clusterone submit/logs/download/sweep/mount`) and the REST API (`/api/v1/*`, Bearer `c1u_…` keys) are documented in the Guide. Neither was executed during the audit.

## Totals

- **Features documented:** 30.
- **Verified working or verified display:** 19 (F01–F04, F06–F08, F10, F12, F17, F18, F21–F26, F28 page, F30 content).
- **Partially observed:** 1 (F05).
- **Restricted:** 1 (F29).
- **Not tested:** 9 (F09, F11, F13, F14, F15, F16, F19, F20, and F27, which was a deliberate skip).
- **Failed:** 0.
