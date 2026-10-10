# ClusterOne — Issues, Limitations and Uncertainties

Severity scale: **High** = blocks a user goal · **Medium** = can mislead users or cost performance · **Low** = cosmetic or minor.

None of these items is a confirmed functional failure. Every interaction that was actually attempted worked or was correctly access-controlled.

## A. Audit limitations (about this audit, not the product)

| ID | Item | Impact |
|---|---|---|
| A-01 | The audit sandbox could not open the site (outbound proxy HTTP 403). A raw HTTP fetch returns only an empty SPA shell. All evidence came from the owner's browser: screenshots and copied page text. | No console or network logs; no automated click-through. |
| A-02 | Eight pages were not captured: My jobs, Submit job, Workspaces, My files, Environments, My account, Wall display, Node detail. | Their behaviour is documented from the Guide only, or marked Not tested. |
| A-03 | Only a `User · default` account was available. | Admin features (users, roles, quotas, audit log, settings) could not be seen. |
| A-04 | Performance figures on the Showcase (349 img/s, 0.35 ms RTT, < 1 s gang start, 108 s rejoin, 3.25× on 4 PCs) are the site's own claims. | Not independently reproduced here. |

## B. Product observations

| ID | Observation | Evidence | Severity |
|---|---|---|---|
| I-01 | **TensorFlow has no GPU on this cluster.** The Guide says the `tensorflow` environment is "GPU on Linux nodes; CPU on Windows nodes", and every one of the 7 nodes runs Windows. TF jobs that request a GPU will occupy one without using it. | Guide environments; Nodes "Windows" | Medium |
| I-02 | **Offline nodes keep showing live-looking metrics.** ANAFS PC (offline, "seen 5h ago") still shows CPU 7%, RAM 43% and NET 4.9M on the Overview and map, with no "last known" label. | 01, 02, 03 | Medium |
| I-03 | **API-key path is unclear for regular users.** The Guide and Mounted GPUs manual tell users to create keys under My account → API keys, and the Showcase says the User role can "Create own API keys". Yet `/api-keys` returns "You don't have access to this page" for `User · default`. It may be an admin-only management page while the personal key box lives on `/account`, but this was not verified. | 05; Guide; Mounts manual | Medium (uncertain) |
| I-04 | **GPU busy but labelled "free".** On Nodes, Reyad PC's RTX 2050 shows 100% utilisation, 73 °C and 44 W while tagged "free" with "0 running". The load probably comes from the PC owner's own work. The label describes cluster allocation, not real availability. | 03 | Medium |
| I-05 | **Empty pipeline stage in the Showcase demo.** In the 22 GB pipeline slider, the 5th stage reads "Reyad PC … layers 49–48" with 0.9 GB: an empty (reversed) layer range. | Showcase text | Low |
| I-06 | **High host RAM pressure on several nodes** from local use (raihan 93–94%, Reyad PC 83–92%, JIhansPC 89–90%). This limits the RAM jobs can safely request. The Guide caps one job at 14 GB. | 01, 02, Overview text | Medium (operational) |
| I-07 | **Slow links.** One PC is on 10 Mbps (Showcase). The Guide flags raihan and Reyad PC as "slow link" inside the 5-PC multi-PC group, which hurts DDP and pipeline jobs that include them. | Showcase limits; Guide table | Medium (operational) |
| I-08 | **Shared dataset not cached anywhere.** `imagenette2-320` shows "Cached on: –", so the first job using it pays the download cost. | Guide | Low |
| I-09 | **Empty metadata field.** Node subtitles read "hostname · — · seen …"; the middle field is blank for all nodes, and raihan also has no hostname. | 03 | Low |
| I-10 | **"Cluster healthy" with 2 of 7 nodes offline.** The wording may hide reduced capacity. The pooled totals do update. | 01, 03 | Low |
| I-11 | **Truncated GPU name** ("RTX 3050 6GB Laptop G…") on topology cards; the full name appears on hover elsewhere. | 01, 02 | Low |
| I-12 | **Multi-PC fragility (documented limit).** Gloo only, no FSDP/ZeRO-3; a PC switching off stops the whole multi-PC job. | Guide, Showcase | Known limit |

## C. Open questions

1. What does the `/wall` display show, and who can open it?
2. What does a node click on the map open: a side panel, or `/nodes/{id}`?
3. Does the Playground use the same llama.cpp RPC mechanism as Mounted GPUs?
4. Which login method does the console use?
5. Which scheduler is it exactly (HTCondor is inferred), and which mesh technology?
