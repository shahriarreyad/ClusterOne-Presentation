"""End-to-end integration verification for ClusterOne."""
from fastapi.testclient import TestClient

from app.main import app


def run_checks():
    client = TestClient(app)

    print("Checking /health...")
    r = client.get("/health")
    assert r.status_code == 200, f"/health returned {r.status_code}"
    print("  [OK] /health:", r.json())

    print("Checking /api/v1/cluster/summary...")
    r = client.get("/api/v1/cluster/summary")
    assert r.status_code == 200, f"summary returned {r.status_code}"
    print("  [OK] /api/v1/cluster/summary:", r.json())

    print("Checking /api/v1/cluster/topology...")
    r = client.get("/api/v1/cluster/topology")
    assert r.status_code == 200, f"topology returned {r.status_code}"
    topo = r.json()
    assert "master" in topo and "nodes" in topo
    print(f"  [OK] /api/v1/cluster/topology: master={topo['master']['hostname']}, nodes={len(topo['nodes'])}")

    print("Checking /api/v1/cluster/activity...")
    r = client.get("/api/v1/cluster/activity")
    assert r.status_code == 200, f"activity returned {r.status_code}"
    print(f"  [OK] /api/v1/cluster/activity: {len(r.json())} events")

    print("Checking /api/v1/cluster/storage...")
    r = client.get("/api/v1/cluster/storage")
    assert r.status_code == 200, f"storage returned {r.status_code}"
    print(f"  [OK] /api/v1/cluster/storage: {r.json().get('shares')} shares")

    print("Checking /api/v1/cluster/partitions...")
    r = client.get("/api/v1/cluster/partitions")
    assert r.status_code == 200, f"partitions returned {r.status_code}"
    print(f"  [OK] /api/v1/cluster/partitions: {[p['name'] for p in r.json()]}")

    print("Checking /api/v1/cluster/users...")
    r = client.get("/api/v1/cluster/users")
    assert r.status_code == 200, f"users returned {r.status_code}"
    print(f"  [OK] /api/v1/cluster/users: {len(r.json())} users")

    # Test submitting a workload
    print("Checking POST /api/v1/jobs...")
    job_payload = {
        "name": "Integration-Test-Job",
        "submitted_by": "Reyad",
        "gpu_count": 1,
        "cpu_cores": 4,
        "ram_mb": 16384,
        "partition": "gpu",
        "command": "python train.py --epochs 10",
    }
    r = client.post("/api/v1/jobs", json=job_payload)
    assert r.status_code in (200, 201), f"submit job failed: {r.status_code} {r.text}"
    job = r.json()
    job_id = job["id"]
    print(f"  [OK] Submitted Job #{job_id}: status={job['status']}")

    # Test cancel
    print(f"Checking POST /api/v1/jobs/{job_id}/cancel...")
    r = client.post(f"/api/v1/jobs/{job_id}/cancel")
    assert r.status_code == 200, f"cancel failed: {r.status_code} {r.text}"
    print(f"  [OK] Cancelled Job #{job_id}: status={r.json()['status']}")

    # Test requeue/retry
    print(f"Checking POST /api/v1/jobs/{job_id}/requeue...")
    r = client.post(f"/api/v1/jobs/{job_id}/requeue")
    assert r.status_code in (200, 201), f"requeue failed: {r.status_code} {r.text}"
    requeued_job = r.json()
    print(f"  [OK] Requeued new Job #{requeued_job['id']}: status={requeued_job['status']}")

    print("\n>>> ALL CLUSTERONE END-TO-END CHECKS PASSED PERFECTLY! <<<")

if __name__ == "__main__":
    run_checks()

