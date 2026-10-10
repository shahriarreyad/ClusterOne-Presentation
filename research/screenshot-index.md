# Screenshot Index

All screenshots are genuine captures of the ClusterOne console, taken on 10 Oct 2026 in the project owner's own signed-in browser (account "Reyad", role `User · default`). None was edited apart from file 05.

File 05 was cropped to remove the browser tab strip and the Windows taskbar. Those areas showed unrelated open tabs and personal desktop details. The address bar was kept because it is evidence of the URL.

| File | Page / URL | Feature IDs | What it demonstrates |
|---|---|---|---|
| `assets/screenshots/01-overview-dashboard.png` (1902×947) | Overview `/` | F01–F04, F12 | 7 KPI tiles with sparklines; live cluster topology (master/scheduler + 7 nodes, 2 offline); live activity feed; "Live · updated 0s ago"; sidebar navigation and health card. |
| `assets/screenshots/02-cluster-map-node-tooltip.png` (1582×862) | Cluster map `/cluster` | F07, F08 | The node-hover tooltip ("Reyad PC (reyad) — online · Click for details"); master panel with host, scheduler Online, version 0.1.0 and queue; the "Working together" 5-PC group; all-nodes list. |
| `assets/screenshots/03-nodes-grid.png` (1908×946) | Nodes `/nodes` | F10, F11, F17 | 7 node cards: status, hostname, last seen, CPU/RAM/Net bars, GPU util/VRAM/temperature/power, availability policy, ready environments, running jobs. Search and grid/list toggle visible. Shows issues I-02, I-04, I-09. |
| `assets/screenshots/04-llm-playground-pc-selection.png` (1907×941) | LLM Playground `/playground` | F24–F27 | Model card (Qwen3 8B Q4_K_M), PC picker with 2 PCs selected and offline PCs disabled, fit bar "needs about 7.0 GB", readiness estimate ~3 min, generation settings panel. |
| `assets/screenshots/05-api-keys-restricted.png` (1917×963, cropped) | API keys `/api-keys` | F29 | The permission-denied page for the `User · default` role. Taken at a different time, when only 4/7 nodes were online (64 cores · 4 GPUs · 63 GB). |

## Not used

- A second, zoomed capture of the same `/api-keys` page. It is a duplicate of 05 and was left out.

## Presentation self-test captures (Phase 5)

These are screenshots of the finished presentation, not of the ClusterOne site. They live in `presentation/assets/test-captures/`:

- `test-01-cover.png` — the cover slide.
- `test-02-feature-slide.png` — the Overview dashboard slide with callouts.
- `test-03-architecture.png` — the architecture slide.
- `test-04-diagram-dragged.png` — the architecture diagram after a node was dragged and its info panel opened.
- `test-05-mobile.png` — the presentation at a 390 px phone width.
- `test-06-lightbox.png` — a screenshot opened in the lightbox.
