# ClusterOne — Interaction Test Results

**Method.** Interactions were performed by the project owner in their own signed-in browser (account "Reyad", role `User · default`) and recorded as screenshots or copied page text. The audit sandbox could not open the site itself (proxy HTTP 403), so each result below is based only on the captured state.

All tests were read-only. No job was submitted, no LLM session started, no GPU mounted and no settings changed.

| # | Interaction | Expected | Observed | Evidence | Result |
|---|---|---|---|---|---|
| T01 | Load Overview `/` | Dashboard with live data | KPI tiles, topology, activity feed and "Live · updated 0s ago" rendered | 01 | Verified working |
| T02 | Live refresh | Values update without reload | Two captures of the same page show different figures (CPU 38% vs 30%, network 20 vs 27 KB/s, memory 54 vs 52 GB) | 01 vs Overview text | Verified working |
| T03 | Sidebar → Cluster map `/cluster` | Topology page | Map, master panel, working-together group and all-nodes list rendered | 02 | Verified working |
| T04 | Hover a node on the map | Tooltip | "Reyad PC (reyad) — online · Click for details" | 02 | Verified working |
| T05 | Click a node on the map | Details panel or node page | Not captured | – | Not tested |
| T06 | Sidebar → Nodes `/nodes` | Node inventory | 7 cards with live metrics; offline nodes marked red | 03 | Verified working |
| T07 | Nodes search box / grid–list toggle | Filter and switch layouts | Controls present; not exercised | 03 | Not tested |
| T08 | Sidebar → LLM Playground `/playground` | Session setup | Model card, PC picker, settings and readiness estimate rendered | 04 | Verified working |
| T09 | Tick two PCs in the Playground | Memory total and fit check update | "2 selected · 11 GB GPU memory free"; fit bar "Fits: needs about 7.0 GB" | 04 | Verified working |
| T10 | Offline PCs in the Playground picker | Not selectable | ANAFS PC and Shafin PC are greyed out and tagged "offline" | 04 | Verified working |
| T11 | Press "Start session" | Model loads on the selected GPUs | Deliberately not pressed: it reserves GPUs on other users' PCs | – | Not tested |
| T12 | Open `/mounts` | Live mounts and manual | "Live mounts (0)", Refresh button, manual and command builder (`clusterone mount --gpus 2 --model qwen7b`) | Mounts text | Verified working (display) |
| T13 | Open `/guide` | Documentation | 14 sections, live "what the cluster offers now" table, resource planner output, quota table | Guide text | Verified working |
| T14 | Guide resource planner (default inputs) | Recommended request | 1 GPU ≥ 4 GB, 4 cores, 9 GB RAM, 75 min; lists 4 PCs that fit now | Guide text | Verified working |
| T15 | Open `/showcase` | Product narrative | All sections rendered, including live counters (5/7 PCs, 292 jobs done) | Showcase text | Verified working |
| T16 | Showcase interactive demos (scheduler, pipeline slider, speed-up, roles) | Simulations respond | Their default states appear in the text (e.g. 22 GB model across 5 PCs; 4 PCs → 3.25×). Controls were not exercised. | Showcase text | Not tested |
| T17 | Navigate to `/api-keys` as User role | Access check | "You don't have access to this page." Navigation and the live bar keep working. | 05 | **Restricted**. Access control behaved correctly. |
| T18 | Sidebar health card across sessions | Reflects availability | 84 cores/5 GPUs/71 GB in one capture; 64/4/63 GB with Nodes 4/7 in another | 01, 05 | Verified working |

## Summary

- **Tested interactions:** 18.
- **Verified working:** 13 (T01–T04, T06, T08–T10, T12–T15, T18).
- **Restricted:** 1 (T17).
- **Not tested:** 4 (T05, T07, T11, T16).
- **Failed:** 0.

No failed interaction was observed. Remember that the sample is limited to what was captured.

## Not tested, and why

- **Submit job, My jobs, Workspaces, My files, Environments, My account, Wall display:** these pages were not captured. Submitting a job or starting a workspace consumes shared GPUs.
- **CLI/SDK and REST API:** these need an API key. The test account's role cannot open `/api-keys` (see `issues.md`, I-03).
- **Console and network logs:** the audit browser was not instrumented, so no JS console or network trace exists.
