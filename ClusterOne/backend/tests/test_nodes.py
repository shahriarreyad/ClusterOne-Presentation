def register_sample_node(client, hostname="gpu01"):
    return client.post(
        "/api/v1/nodes/register",
        json={
            "hostname": hostname,
            "ip_address": "10.20.0.11",
            "cpu_cores": 16,
            "ram_total_mb": 32768,
            "gpus": [
                {"name": "RTX 3060", "vram_total_mb": 12288, "vram_used_mb": 0, "utilization_pct": 0}
            ],
        },
    )


def test_register_node(client):
    resp = register_sample_node(client)
    assert resp.status_code == 200
    body = resp.json()
    assert body["hostname"] == "gpu01"
    assert body["status"] == "ONLINE"
    assert body["cpu_cores"] == 16
    assert len(body["gpus"]) == 1


def test_register_node_is_idempotent_by_hostname(client):
    register_sample_node(client)
    resp = register_sample_node(client)
    assert resp.status_code == 200

    listed = client.get("/api/v1/nodes").json()
    assert len(listed) == 1


def test_heartbeat_updates_node(client):
    node = register_sample_node(client).json()

    resp = client.post(
        f"/api/v1/nodes/{node['id']}/heartbeat",
        json={
            "cpu_util_pct": 42.5,
            "ram_used_mb": 4096,
            "gpus": [
                {"name": "RTX 3060", "vram_total_mb": 12288, "vram_used_mb": 9000, "utilization_pct": 87}
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["cpu_util_pct"] == 42.5
    assert body["gpus"][0]["utilization_pct"] == 87


def test_heartbeat_unknown_node_404(client):
    resp = client.post(
        "/api/v1/nodes/does-not-exist/heartbeat",
        json={"cpu_util_pct": 1.0, "ram_used_mb": 1, "gpus": []},
    )
    assert resp.status_code == 404


def test_get_node_not_found(client):
    resp = client.get("/api/v1/nodes/does-not-exist")
    assert resp.status_code == 404
