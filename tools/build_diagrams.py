"""Generate the three ClusterOne diagrams from one spec.

Outputs
  assets/diagrams/system-architecture.svg
  assets/diagrams/feature-map.svg
  assets/diagrams/user-workflow.svg
  presentation/assets/diagrams-data.js   (same spec, used by the interactive deck)

Run from the project root:  python3 tools/build_diagrams.py
"""
import json, os
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- styles
STYLE = {
    # evidence levels (architecture) and audit statuses (feature map) -> Archify semantic hues
    "C":  {"stroke": "#0891b2", "dash": "",    "fill": "#def8fd", "name": "Confirmed on site"},
    "I":  {"stroke": "#7c3aed", "dash": "7 4", "fill": "#ede8fd", "name": "Inference"},
    "T":  {"stroke": "#d97706", "dash": "9 3", "fill": "#fef3d8", "name": "Team-stated (not visible on site)"},
    "U":  {"stroke": "#64748b", "dash": "2 4", "fill": "#eceef2", "name": "Unknown"},
    "ins": {"stroke": "#059669", "dash": "",    "fill": "#daf7ed", "name": "Inspected (screenshot / text)"},
    "lnk": {"stroke": "#64748b", "dash": "4 4", "fill": "#eceef2", "name": "Linked only (not captured)"},
    "res": {"stroke": "#e11d48", "dash": "",    "fill": "#feeaed", "name": "Restricted for test role"},
    "hub": {"stroke": "#111827", "dash": "",    "fill": "#f1f2f5", "name": ""},
    "step": {"stroke": "#0891b2", "dash": "",   "fill": "#def8fd", "name": "Step"},
    "alt": {"stroke": "#7c3aed", "dash": "",    "fill": "#ede8fd", "name": "Alternative path"},
}

# ------------------------------------------------------- architecture spec
ARCH = {
    "id": "arch", "w": 1200, "h": 700,
    "title": "ClusterOne — system architecture (evidence-labelled)",
    "legend": ["C", "I", "T", "U"],
    "groups": [
        {"label": "Clients", "x": 20, "y": 20, "w": 1160, "h": 100},
        {"label": "Master · cloud server (ClusterOne console)", "x": 20, "y": 215, "w": 1160, "h": 230},
        {"label": "Lab Windows PCs (7 registered)", "x": 20, "y": 470, "w": 1160, "h": 120},
    ],
    "nodes": [
        {"id": "browser", "label": "Web browser", "sub": "console UI · phones too", "x": 50, "y": 50, "w": 200, "h": 56, "lv": "C",
         "info": "Users open the console in any browser. The page HTML is an empty shell; the UI renders client-side (SPA). Evidence: raw fetch; screenshots 01–05."},
        {"id": "cli", "label": "CLI / Python SDK", "sub": "pip install …/clusterone-sdk.zip", "x": 280, "y": 50, "w": 230, "h": 56, "lv": "C",
         "info": "`clusterone submit/logs/download/sweep/mount`, plus `from clusterone import Client`. Authenticates with an API key. Evidence: Guide › Terminal & Python SDK."},
        {"id": "apikey", "label": "Scripts / CI", "sub": "REST + c1u_ API keys", "x": 540, "y": 50, "w": 200, "h": 56, "lv": "C",
         "info": "Any language over REST, with `Authorization: Bearer c1u_…` or X-API-Key. Keys are scoped, with expiry, IP allow-list and rate limit. Evidence: Guide › Automate with the API."},
        {"id": "mountpc", "label": "User PC + llama.cpp", "sub": "Mounted GPUs · OpenAI API :8080", "x": 950, "y": 50, "w": 220, "h": 56, "lv": "C",
         "info": "`clusterone mount --gpus 2 --model qwen7b`. The user's PC runs llama.cpp and borrows lab GPUs as remote backends. Prompts stay on the user's PC. Evidence: Mounted GPUs manual."},
        {"id": "cf", "label": "Cloudflare · HTTPS", "sub": "HTTPS edge · TLS", "x": 470, "y": 140, "w": 260, "h": 50, "lv": "C",
         "info": "The Showcase says the master sits behind Cloudflare with HTTPS."},
        {"id": "spa", "label": "Web console (SPA)", "sub": "16 routes · live ~1 s refresh", "x": 50, "y": 250, "w": 210, "h": 60, "lv": "C",
         "info": "Overview, Cluster map, Nodes, Jobs, Submit, Workspaces, Files, Playground, Mounts, Environments, Showcase, Guide, Account, Wall, API keys. Front-end framework: unknown."},
        {"id": "api", "label": "REST API /api/v1", "sub": "jobs · nodes · cluster/live · auth", "x": 290, "y": 250, "w": 240, "h": 60, "lv": "C",
         "info": "Endpoints are documented in the Guide. Errors come back as {\"detail\": …} with 400/401/403/429. FastAPI is inferred from the error shape and from team notes."},
        {"id": "rbac", "label": "RBAC · quotas · audit", "sub": "5 roles + custom · per-user limits", "x": 560, "y": 250, "w": 250, "h": 60, "lv": "C",
         "info": "Administrator, Operator, User, API client, Viewer. Quotas per user, group or key. Verified: /api-keys is denied to the `User · default` role (screenshot 05)."},
        {"id": "mon", "label": "Live monitoring", "sub": "auto-healing · agent upgrades", "x": 50, "y": 350, "w": 210, "h": 60, "lv": "C",
         "info": "Feeds the dashboard, map and activity log. Agents upgrade themselves and rejoin after a master restart (claimed 108 s)."},
        {"id": "sched", "label": "Scheduler", "sub": "fair-share queue · gang dispatcher", "x": 290, "y": 350, "w": 240, "h": 60, "lv": "C",
         "info": "Fair-share between groups, gang start (all PCs of a multi-PC job start together or none), avoids PCs in local use. Described as a high-throughput scheduler 'used at CERN'."},
        {"id": "condor", "label": "HTCondor (likely)", "sub": "state names idle/held/transferring", "x": 560, "y": 350, "w": 250, "h": 60, "lv": "I",
         "info": "Inference: the Showcase description and the job states in the API client match HTCondor. The site never names the scheduler."},
        {"id": "db", "label": "Database + queue", "sub": "backed up per update", "x": 840, "y": 250, "w": 180, "h": 60, "lv": "C",
         "info": "Existence and backup policy are stated on the Showcase. The engine is not visible on the site."},
        {"id": "pg", "label": "FastAPI + PostgreSQL", "sub": "asyncpg · 7 tables", "x": 840, "y": 350, "w": 180, "h": 60, "lv": "T",
         "info": "From the team's own project notes: FastAPI back end, PostgreSQL via asyncpg, tables users, nodes, gpus, jobs, job_logs, distributed_jobs, node_assignments. Not observable on the live site."},
        {"id": "agent", "label": "Node agent ×7", "sub": "outbound-only · self-updating", "x": 50, "y": 505, "w": 230, "h": 60, "lv": "C",
         "info": "Reports GPU health, builds environments, applies firewall rules, upgrades itself. Outbound connections only, so no port forwarding is needed."},
        {"id": "sandbox", "label": "Job sandbox", "sub": "low-priv account · own GPU only", "x": 310, "y": 505, "w": 230, "h": 60, "lv": "C",
         "info": "Each job runs in a throw-away low-privilege account; CUDA_VISIBLE_DEVICES limits it to its own GPU. Outputs come back from CLUSTERONE_OUTPUT_DIR as outputs.zip."},
        {"id": "envs", "label": "Environments", "sub": "base-sci · pytorch-cu128 · tensorflow", "x": 570, "y": 505, "w": 260, "h": 60, "lv": "C",
         "info": "Built on every node automatically. TensorFlow is CPU-only on Windows, and every node is Windows (issue I-01)."},
        {"id": "gpus", "label": "GPUs", "sub": "RTX 5060 Ti · 3050 ×5 · 2050", "x": 950, "y": 505, "w": 220, "h": 60, "lv": "C",
         "info": "28 GB of VRAM pooled across the 5 online GPUs. Each card shows util, VRAM, temperature and power live (screenshot 03)."},
        {"id": "lan", "label": "Lab LAN 1 Gbps", "sub": "Gloo DDP / GPipe pipeline", "x": 140, "y": 620, "w": 260, "h": 56, "lv": "C",
         "info": "PCs exchange gradients directly. Data-parallel and pipeline modes work; FSDP/ZeRO-3 do not (Gloo only on Windows). Some PCs are on slow links."},
        {"id": "mesh", "label": "Cluster mesh", "sub": "off-site access · tech unknown", "x": 930, "y": 620, "w": 240, "h": 56, "lv": "U",
         "info": "`clusterone mesh join` (admin) lets off-site PCs reach lab PCs. Its existence is confirmed; the underlying technology is unknown."},
        {"id": "data", "label": "Shared dataset cache", "sub": "imagenette2-320 · 326 MB", "x": 560, "y": 620, "w": 260, "h": 56, "lv": "C",
         "info": "Uploaded once by an admin and cached on nodes. Jobs read it from CLUSTERONE_DATASET_DIR. Currently cached on no node."},
    ],
    "edges": [
        ["browser", "cf", ""], ["cli", "cf", ""], ["apikey", "cf", ""],
        ["cf", "spa", ""], ["cf", "api", ""],
        ["spa", "api", ""], ["api", "rbac", ""], ["api", "sched", "submit"], ["rbac", "db", ""],
        ["sched", "condor", "", "I"], ["db", "pg", "", "T"], ["mon", "spa", "live"],
        ["agent", "sched", "jobs (outbound)", ""], ["agent", "mon", "metrics"],
        ["agent", "sandbox", ""], ["sandbox", "envs", ""], ["envs", "gpus", ""],
        ["agent", "lan", ""], ["mountpc", "gpus", "llama.cpp RPC"], ["gpus", "mesh", "off-site", "U"],
        ["sandbox", "data", ""],
    ],
}

# -------------------------------------------------------- feature map spec
def fm_node(i, label, sub, x, y, st, info, w=170, h=50):
    return {"id": i, "label": label, "sub": sub, "x": x, "y": y, "w": w, "h": h, "lv": st, "info": info}

FMAP = {
    "id": "fmap", "w": 1200, "h": 640,
    "title": "ClusterOne — feature map (coloured by audit coverage)",
    "legend": ["ins", "lnk", "res"],
    "groups": [
        {"label": "Monitor", "x": 20, "y": 20, "w": 380, "h": 260},
        {"label": "Compute", "x": 800, "y": 20, "w": 380, "h": 260},
        {"label": "AI / LLM", "x": 20, "y": 360, "w": 380, "h": 260},
        {"label": "Help", "x": 420, "y": 470, "w": 360, "h": 150},
        {"label": "Account & admin", "x": 800, "y": 360, "w": 380, "h": 260},
    ],
    "nodes": [
        fm_node("hub", "ClusterOne console", "GPU cluster console · v0.1.0", 465, 250, "hub",
                "The hub: a sidebar with 15 navigation items in 3 groups, plus a global 'Live' bar and a Submit job button on every page.", w=270, h=70),
        fm_node("ov", "Overview", "KPIs · topology · activity", 40, 55, "ins", "Screenshot 01. 7 KPI tiles, live topology, activity feed, utilisation charts."),
        fm_node("map", "Cluster map", "hover tooltip · master panel", 220, 55, "ins", "Screenshot 02. Hover tooltip verified; node click not tested."),
        fm_node("nodes", "Nodes", "7 cards · live GPU", 40, 135, "ins", "Screenshot 03. Live CPU/RAM/Net/GPU per PC, availability policy, environments."),
        fm_node("ndet", "Node detail", "/nodes/{id}", 220, 135, "lnk", "Linked from the Overview (7 IDs); not opened."),
        fm_node("wall", "Wall display", "/wall · admin group", 130, 215, "lnk", "Listed under Administration; not opened."),
        fm_node("sub", "Submit job", "web · CLI · SDK · REST", 820, 55, "lnk", "Documented in the Guide (code, zip, Git, dataset); the form was not opened."),
        fm_node("jobs", "My jobs", "statuses · logs · outputs", 1000, 55, "lnk", "Statuses and exit codes are documented in the Guide; the page was not opened."),
        fm_node("ws", "Workspaces", "JupyterLab / VS Code", 820, 135, "lnk", "Known only from the quota table."),
        fm_node("files", "My files", "personal storage 20 GB", 1000, 135, "lnk", "Known only from the quota table."),
        fm_node("env", "Environments", "base-sci · pytorch · tf", 910, 215, "lnk", "The page was not opened; the environment list is visible in the Guide and on node cards."),
        fm_node("play", "LLM Playground", "177 models · multi-GPU", 40, 395, "ins", "Screenshot 04. PC selection and fit check verified; Start session deliberately not pressed."),
        fm_node("mnt", "Mounted GPUs", "llama.cpp on your PC", 220, 395, "ins", "Page text captured. Live mounts (0), a 12-section manual and a command builder."),
        fm_node("multi", "Multi-PC jobs", "DDP · pipeline", 130, 475, "lnk", "Documented in the Guide and Showcase; no job was run."),
        fm_node("show", "Showcase", "story · demos · claims", 440, 505, "ins", "Page text captured. Measured claims and interactive demos."),
        fm_node("guide", "Guide", "planner · recipes · API", 610, 505, "ins", "Page text captured. Resource planner, 10 recipes, API reference, quotas."),
        fm_node("acct", "My account", "profile · own keys?", 820, 395, "lnk", "Not opened. The Guide says personal API keys are created here."),
        fm_node("keys", "API keys", "/api-keys", 1000, 395, "res", "Screenshot 05: 'You don't have access to this page' for the User role."),
        fm_node("roles", "Roles & quotas", "5 roles · fair share", 910, 475, "lnk", "Described on the Showcase and in the Guide limits table; admin screens not visible."),
    ],
    "edges": [["hub", n, ""] for n in ["map", "ws", "mnt", "show", "guide", "acct"]] +
             [["map", "ndet", ""], ["nodes", "ndet", ""], ["roles", "keys", ""], ["play", "multi", ""]],
}

# ----------------------------------------------------------- workflow spec
def st(i, label, sub, x, y, lv="step", info="", w=180, h=58):
    return {"id": i, "label": label, "sub": sub, "x": x, "y": y, "w": w, "h": h, "lv": lv, "info": info}

FLOW = {
    "id": "flow", "w": 1200, "h": 560,
    "title": "ClusterOne — user workflow (from Guide, Showcase and Mounts manual)",
    "legend": ["step", "alt"],
    "groups": [
        {"label": "1 · Orient", "x": 20, "y": 20, "w": 240, "h": 520},
        {"label": "2 · Run work", "x": 280, "y": 20, "w": 660, "h": 520},
        {"label": "3 · Results", "x": 960, "y": 20, "w": 220, "h": 520},
    ],
    "nodes": [
        st("login", "Sign in", "role sets what you see", 50, 60, info="Role and quotas apply everywhere. The login page itself was not captured."),
        st("look", "Check capacity", "Overview · Map · Nodes", 50, 190, info="See which PCs are online, how much GPU memory is free and what is ready (screenshots 01–03)."),
        st("plan", "Plan resources", "Guide › resource planner", 50, 320, info="The planner turns a workload and data size into GPUs, cores, RAM and a time limit, and lists PCs that fit now."),
        st("submit", "Submit job", "web · CLI · SDK · REST", 310, 60, info="Choose environment, GPUs, RAM and time. Quotas are checked immediately and the submission is audit-logged."),
        st("queue", "Queue & match", "fair share · avoids busy PCs", 510, 60, info="The master queues the job fairly and matches it to a free PC with enough GPU memory; gang start for multi-PC jobs."),
        st("run", "Run on lab PC", "sandbox · live log", 730, 60, info="Isolated low-privilege account, own GPU only, stdout streamed live."),
        st("pg", "LLM Playground", "pick model + PCs → chat", 310, 240, "alt", info="Pick a model, tick PCs until it fits, then Start session (screenshot 04)."),
        st("pgrun", "Model spread on GPUs", "ready in ~3 min", 610, 240, "alt", info="Layers are spread over the selected GPUs: download, spread, load."),
        st("mount", "Mount GPUs", "clusterone mount …", 310, 410, "alt", info="Borrow lab GPUs for llama.cpp on your own PC; they auto-release 5 minutes after the client goes quiet."),
        st("mrun", "Local OpenAI API", "127.0.0.1:8080/v1", 610, 410, "alt", info="Use the model from chat apps or Python; prompts stay local."),
        st("out", "Download outputs", "outputs.zip", 990, 60, info="Everything written to CLUSTERONE_OUTPUT_DIR comes back as a zip."),
        st("chat", "Chat / results", "in browser or own apps", 990, 320, "alt", info="Playground sessions keep the model loaded; stop the session to free the GPUs."),
        st("free", "Release GPUs", "stop session · Ctrl+C", 990, 440, "alt", info="Release returns capacity to everyone; fair use is expected."),
    ],
    "edges": [["login", "look", ""], ["look", "plan", ""], ["plan", "submit", ""], ["submit", "queue", ""], ["queue", "run", ""],
              ["run", "out", ""], ["plan", "pg", ""], ["pg", "pgrun", ""], ["pgrun", "chat", ""], ["plan", "mount", ""],
              ["mount", "mrun", ""], ["mrun", "chat", ""], ["chat", "free", ""]],
}

DIAGRAMS = [ARCH, FMAP, FLOW]

# ------------------------------------------------------------ SVG export
def clip(ax, ay, aw, ah, bx, by):
    """Point where the segment from rect A's centre toward (bx, by) leaves rect A."""
    cx, cy = ax + aw / 2, ay + ah / 2
    dx, dy = bx - cx, by - cy
    if dx == 0 and dy == 0:
        return cx, cy
    tx = (aw / 2) / abs(dx) if dx else 1e9
    ty = (ah / 2) / abs(dy) if dy else 1e9
    t = min(tx, ty)
    return cx + dx * t, cy + dy * t

def svg_for(d):
    nodes = {n["id"]: n for n in d["nodes"]}
    W, H = d["w"], d["h"] + 50
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Inter, Segoe UI, system-ui, sans-serif">',
         f'<title>{escape(d["title"])}</title>',
         '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
         '<path d="M0,0 L10,5 L0,10 z" fill="#94a3b8"/></marker></defs>',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>']
    for g in d["groups"]:
        o.append(f'<g class="group"><rect x="{g["x"]}" y="{g["y"]}" width="{g["w"]}" height="{g["h"]}" rx="14" fill="#f6f7f9" stroke="#e5e7eb"/>'
                 f'<text x="{g["x"]+14}" y="{g["y"]+18}" font-size="12" fill="#5b6474" letter-spacing="1">{escape(g["label"].upper())}</text></g>')
    for e in d["edges"]:
        a, b = nodes[e[0]], nodes[e[1]]
        x1, y1 = clip(a["x"], a["y"], a["w"], a["h"], b["x"] + b["w"] / 2, b["y"] + b["h"] / 2)
        x2, y2 = clip(b["x"], b["y"], b["w"], b["h"], a["x"] + a["w"] / 2, a["y"] + a["h"] / 2)
        lv = e[3] if len(e) > 3 and e[3] else ""
        dash = f' stroke-dasharray="{STYLE[lv]["dash"]}"' if lv else ""
        o.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#94a3b8" stroke-width="1.5"{dash} marker-end="url(#arr)"/>')
        if e[2]:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            o.append(f'<text x="{mx:.1f}" y="{my-5:.1f}" font-size="11" fill="#5b6474" text-anchor="middle" paint-order="stroke" stroke="#ffffff" stroke-width="4">{escape(e[2])}</text>')
    for n in d["nodes"]:
        s = STYLE[n["lv"]]
        dash = f' stroke-dasharray="{s["dash"]}"' if s["dash"] else ""
        cx = n["x"] + n["w"] / 2
        o.append(f'<g id="{n["id"]}"><rect x="{n["x"]}" y="{n["y"]}" width="{n["w"]}" height="{n["h"]}" rx="10" fill="{s["fill"]}" stroke="{s["stroke"]}" stroke-width="1.8"{dash}/>'
                 f'<text x="{cx}" y="{n["y"]+n["h"]/2-3}" font-size="15" font-weight="600" fill="#111827" text-anchor="middle">{escape(n["label"])}</text>'
                 f'<text x="{cx}" y="{n["y"]+n["h"]/2+15}" font-size="11.5" fill="#5b6474" text-anchor="middle">{escape(n["sub"])}</text></g>')
    lx = 20
    for k in d["legend"]:
        s = STYLE[k]
        dash = f' stroke-dasharray="{s["dash"]}"' if s["dash"] else ""
        o.append(f'<rect x="{lx}" y="{d["h"]+16}" width="26" height="16" rx="4" fill="{s["fill"]}" stroke="{s["stroke"]}" stroke-width="1.8"{dash}/>'
                 f'<text x="{lx+34}" y="{d["h"]+29}" font-size="12.5" fill="#5b6474">{escape(s["name"])}</text>')
        lx += 46 + len(s["name"]) * 7.2
    o.append('</svg>')
    return "\n".join(o)

if __name__ == "__main__":
    names = {"arch": "system-architecture", "fmap": "feature-map", "flow": "user-workflow"}
    for d in DIAGRAMS:
        p = os.path.join(ROOT, "assets/diagrams", names[d["id"]] + ".svg")
        open(p, "w").write(svg_for(d))
        print("wrote", p)
    js = "window.C1_DIAGRAMS = " + json.dumps({d["id"]: d for d in DIAGRAMS}) + ";\nwindow.C1_STYLE = " + json.dumps(STYLE) + ";\n"
    open(os.path.join(ROOT, "presentation/assets/diagrams-data.js"), "w").write(js)
    print("wrote diagrams-data.js")
