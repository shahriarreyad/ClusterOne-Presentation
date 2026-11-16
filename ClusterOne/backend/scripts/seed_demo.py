"""Register demo GPU nodes and a few jobs against a running backend.

Usage: python scripts/seed_demo.py [http://127.0.0.1:8000]
"""
import sys

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000") + "/api/v1"

NODES = [
    ("GPU01", "RTX 3050", 8192, 78),
    ("GPU02", "RTX 3050", 8192, 0),
    ("GPU03", "RTX 3060", 12288, 87),
    ("GPU04", "RTX 4060", 8192, 0),
]

with httpx.Client(timeout=10) as c:
    for host, gpu, vram, util in NODES:
        r = c.post(f"{BASE}/nodes/register", json={
            "hostname": host, "ip_address": "10.0.0.1", "cpu_cores": 8, "ram_total_mb": 32768,
            "gpus": [{"name": gpu, "vram_total_mb": vram}],
        })
        r.raise_for_status()
        c.post(f"{BASE}/nodes/{r.json()['id']}/heartbeat", json={
            "cpu_util_pct": 40.0, "ram_used_mb": 9000,
            "gpus": [{"name": gpu, "vram_total_mb": vram, "vram_used_mb": vram // 2, "utilization_pct": util}],
        }).raise_for_status()
    for name in ("resnet-train", "bert-finetune"):
        c.post(f"{BASE}/jobs", json={"name": name, "submitted_by": "demo", "min_vram_mb": 4096}).raise_for_status()
    print("seeded", len(c.get(f"{BASE}/nodes").json()), "nodes,", len(c.get(f"{BASE}/jobs").json()), "jobs")
