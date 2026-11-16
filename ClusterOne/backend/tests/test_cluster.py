from tests.test_nodes import register_sample_node


def test_cluster_summary_empty(client):
    resp = client.get("/api/v1/cluster/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["nodes_total"] == 0
    assert body["gpus_total"] == 0


def test_cluster_summary_counts_nodes_and_gpus(client):
    register_sample_node(client, hostname="gpu06")
    register_sample_node(client, hostname="gpu07")

    resp = client.get("/api/v1/cluster/summary")
    body = resp.json()
    assert body["nodes_total"] == 2
    assert body["nodes_online"] == 2
    assert body["gpus_total"] == 2
    assert body["gpus_idle"] == 2


def test_healthz(client):
    resp = client.get("/api/v1/cluster/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_cluster_activity_and_storage_and_partitions(client):
    register_sample_node(client, hostname="gpu-act")
    resp_act = client.get("/api/v1/cluster/activity")
    assert resp_act.status_code == 200
    assert isinstance(resp_act.json(), list)

    resp_st = client.get("/api/v1/cluster/storage")
    assert resp_st.status_code == 200
    body_st = resp_st.json()
    assert "shares" in body_st
    assert len(body_st["shares"]) >= 4

    resp_part = client.get("/api/v1/cluster/partitions")
    assert resp_part.status_code == 200
    assert len(resp_part.json()) >= 1

    client.post("/api/v1/jobs", json={"name": "test-job-user", "submitted_by": "reyad", "requires_gpu": False})
    resp_users = client.get("/api/v1/cluster/users")
    assert resp_users.status_code == 200
    assert len(resp_users.json()) >= 1


def test_telemetry_ingestion(client):
    payload = {
        "nodeId": "gpu-telemetry-01",
        "hostname": "gpu-telemetry-01",
        "ip": "10.20.0.99",
        "cpu": {"percent": 45.2},
        "memory": {"usedMb": 8192, "totalMb": 32768},
        "gpus": [
            {"name": "RTX 4090", "utilization": 82.0, "memoryUsedMb": 12000, "memoryTotalMb": 24576, "temperatureC": 65.0}
        ],
    }
    resp = client.post("/api/v1/cluster/telemetry", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

