"""Seed the ClusterOne database with the authentic DIU CSE 12-week pilot cluster data.

Nodes:
  - gpu-node-01: 10.20.0.21 · 2 × NVIDIA RTX 4090 (24GB)
  - gpu-node-02: 10.20.0.22 · 2 × NVIDIA RTX 4090 (24GB)
  - gpu-node-03: 10.20.0.23 · 1 × NVIDIA RTX 3060 (12GB)
  - gpu-node-04: 10.20.0.24 · 1 × NVIDIA RTX 3060 (12GB)
  - gpu-node-05: 10.20.0.25 · 1 × NVIDIA RTX 3050 (8GB)
  - gpu-node-06: 10.20.0.26 · 1 × NVIDIA RTX 3050 (8GB)

Usage:
  python scripts/seed_pilot_cluster.py [http://127.0.0.1:8000]
"""
import sys

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000") + "/api/v1"

PILOT_NODES = [
    {
        "hostname": "gpu-node-01",
        "ip_address": "10.20.0.21",
        "cpu_cores": 16,
        "ram_total_mb": 65536,
        "cpu_util_pct": 52.0,
        "ram_used_mb": 34800,
        "gpus": [
            {"name": "NVIDIA GeForce RTX 4090", "vram_total_mb": 24576, "vram_used_mb": 18400, "utilization_pct": 86, "temperature_c": 68, "power_w": 310},
            {"name": "NVIDIA GeForce RTX 4090", "vram_total_mb": 24576, "vram_used_mb": 17800, "utilization_pct": 82, "temperature_c": 66, "power_w": 295},
        ],
    },
    {
        "hostname": "gpu-node-02",
        "ip_address": "10.20.0.22",
        "cpu_cores": 16,
        "ram_total_mb": 65536,
        "cpu_util_pct": 48.0,
        "ram_used_mb": 31200,
        "gpus": [
            {"name": "NVIDIA GeForce RTX 4090", "vram_total_mb": 24576, "vram_used_mb": 19200, "utilization_pct": 88, "temperature_c": 69, "power_w": 320},
            {"name": "NVIDIA GeForce RTX 4090", "vram_total_mb": 24576, "vram_used_mb": 18900, "utilization_pct": 84, "temperature_c": 67, "power_w": 305},
        ],
    },
    {
        "hostname": "gpu-node-03",
        "ip_address": "10.20.0.23",
        "cpu_cores": 8,
        "ram_total_mb": 32768,
        "cpu_util_pct": 36.0,
        "ram_used_mb": 14200,
        "gpus": [
            {"name": "NVIDIA GeForce RTX 3060", "vram_total_mb": 12288, "vram_used_mb": 7800, "utilization_pct": 64, "temperature_c": 62, "power_w": 145},
        ],
    },
    {
        "hostname": "gpu-node-04",
        "ip_address": "10.20.0.24",
        "cpu_cores": 8,
        "ram_total_mb": 32768,
        "cpu_util_pct": 8.0,
        "ram_used_mb": 4200,
        "gpus": [
            {"name": "NVIDIA GeForce RTX 3060", "vram_total_mb": 12288, "vram_used_mb": 512, "utilization_pct": 0, "temperature_c": 38, "power_w": 35},
        ],
    },
    {
        "hostname": "gpu-node-05",
        "ip_address": "10.20.0.25",
        "cpu_cores": 8,
        "ram_total_mb": 32768,
        "cpu_util_pct": 24.0,
        "ram_used_mb": 8400,
        "gpus": [
            {"name": "NVIDIA GeForce RTX 3050", "vram_total_mb": 8192, "vram_used_mb": 3800, "utilization_pct": 42, "temperature_c": 54, "power_w": 90},
        ],
    },
    {
        "hostname": "gpu-node-06",
        "ip_address": "10.20.0.26",
        "cpu_cores": 8,
        "ram_total_mb": 32768,
        "cpu_util_pct": 5.0,
        "ram_used_mb": 3800,
        "gpus": [
            {"name": "NVIDIA GeForce RTX 3050", "vram_total_mb": 8192, "vram_used_mb": 256, "utilization_pct": 0, "temperature_c": 35, "power_w": 30},
        ],
    },
]

PILOT_JOBS = [
    {
        "name": "Bengali-NLP-Training",
        "submitted_by": "Reyad",
        "gpu_count": 2,
        "cpu_cores": 8,
        "ram_mb": 32768,
        "partition": "gpu",
        "time_limit": "04:00:00",
        "image": "/opt/apptainer/pytorch-cuda.sif",
        "dataset_path": "/datasets/bengali-nlp",
        "output_dir": "/home/reyad/output",
        "command": "python train.py --dataset /datasets/bengali-nlp --epochs 50 --batch-size 32 --device cuda",
    },
    {
        "name": "Medical-Imaging-Diagnostics",
        "submitted_by": "Sourov",
        "gpu_count": 2,
        "cpu_cores": 8,
        "ram_mb": 32768,
        "partition": "gpu",
        "time_limit": "06:00:00",
        "image": "/opt/apptainer/pytorch-cuda.sif",
        "dataset_path": "/datasets/medical-dicom",
        "output_dir": "/home/sourov/output",
        "command": "python train_densenet.py --epochs 40 --batch-size 16",
    },
    {
        "name": "Autonomous-Robotics-Vision",
        "submitted_by": "Tanvir",
        "gpu_count": 1,
        "cpu_cores": 4,
        "ram_mb": 16384,
        "partition": "gpu",
        "time_limit": "03:00:00",
        "image": "/opt/apptainer/pytorch-cuda.sif",
        "dataset_path": "/datasets/robotics-lidar",
        "output_dir": "/home/tanvir/output",
        "command": "python lidar_detect.py --epochs 25",
    },
    {
        "name": "Undergraduate-Coursework-Lab",
        "submitted_by": "Student_Lab_01",
        "gpu_count": 1,
        "cpu_cores": 4,
        "ram_mb": 16384,
        "partition": "teaching",
        "time_limit": "02:00:00",
        "image": "/opt/apptainer/pytorch-cuda.sif",
        "dataset_path": "/datasets/mnist-cifar",
        "output_dir": "/home/student01/output",
        "command": "python cnn_lab.py --epochs 10",
    },
]

def main():
    print(f"Connecting to ClusterOne at {BASE}...")
    with httpx.Client(timeout=15) as client:
        # 1. Register and heartbeat each pilot GPU node
        for n in PILOT_NODES:
            reg_payload = {
                "hostname": n["hostname"],
                "ip_address": n["ip_address"],
                "cpu_cores": n["cpu_cores"],
                "ram_total_mb": n["ram_total_mb"],
                "gpus": [{"name": g["name"], "vram_total_mb": g["vram_total_mb"]} for g in n["gpus"]],
                "os_info": "Ubuntu 24.04 LTS (Linux 6.8.0-31-generic)",
                "agent_version": "ClusterOne-Agent v1.0.0",
            }
            res = client.post(f"{BASE}/nodes/register", json=reg_payload)
            if res.status_code in (200, 201):
                node_id = res.json()["id"]
                print(f"  [+] Registered node: {n['hostname']} ({n['ip_address']}) -> ID: {node_id}")

                # Send live heartbeat with telemetry
                hb_payload = {
                    "cpu_util_pct": n["cpu_util_pct"],
                    "ram_used_mb": n["ram_used_mb"],
                    "gpus": n["gpus"],
                    "net_rx_mbps": 420.5,
                    "net_tx_mbps": 180.2,
                }
                client.post(f"{BASE}/nodes/{node_id}/heartbeat", json=hb_payload)
            else:
                print(f"  [!] Failed to register {n['hostname']}: {res.status_code} {res.text}")

        # 2. Submit sample research workloads
        for j in PILOT_JOBS:
            j_res = client.post(f"{BASE}/jobs", json=j)
            if j_res.status_code in (200, 201):
                job_data = j_res.json()
                print(f"  [+] Submitted job: #{job_data['id']} '{j['name']}' ({job_data['status']})")
            else:
                print(f"  [!] Failed to submit job {j['name']}: {j_res.status_code} {j_res.text}")

        # 3. Check summary
        summary = client.get(f"{BASE}/cluster/summary").json()
        print("\n=== ClusterOne Status Summary ===")
        print(f"Nodes Total: {summary.get('nodes_total')} | Online: {summary.get('nodes_online')}")
        print(f"GPUs Total:  {summary.get('gpus_total')}  | Allocated: {summary.get('gpus_allocated')} | Idle: {summary.get('gpus_idle')}")
        print(f"Jobs Active: {summary.get('jobs_running')} | Queued: {summary.get('jobs_pending')}")

if __name__ == "__main__":
    main()

