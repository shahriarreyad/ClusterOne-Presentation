"""Node registration, heartbeat, offline detection and the topology the dashboard draws."""
from datetime import timedelta

from app.models import Node
from app.utils import utcnow
from tests.test_nodes import register_sample_node


def age_heartbeat(client, node_id, seconds):
    with client.session_factory() as db:
        node = db.get(Node, node_id)
        node.last_heartbeat = utcnow() - timedelta(seconds=seconds)
        db.commit()


def test_reregistration_keeps_id_and_refreshes_specs(client):
    first = register_sample_node(client).json()
    second = client.post("/api/v1/nodes/register", json={
        "hostname": "gpu01", "ip_address": "10.20.0.21", "cpu_cores": 32, "ram_total_mb": 65536,
        "gpus": [{"name": "A100", "vram_total_mb": 40960}, {"name": "A100", "vram_total_mb": 40960}],
    }).json()
    assert second["id"] == first["id"]
    assert second["cpu_cores"] == 32 and second["ip_address"] == "10.20.0.21"
    assert second["gpu_count"] == 2
    assert len(client.get("/api/v1/nodes").json()) == 1


def test_register_rejects_bad_hostname(client):
    r = client.post("/api/v1/nodes/register", json={"hostname": "bad host;rm", "cpu_cores": 1, "ram_total_mb": 1})
    assert r.status_code == 422


def test_silent_node_is_marked_down(client):
    node = register_sample_node(client).json()
    age_heartbeat(client, node["id"], 3600)
    assert client.get("/api/v1/nodes").json()[0]["status"] == "DOWN"
    assert client.get("/api/v1/cluster/summary").json()["nodes_down"] == 1


def test_get_single_node_also_detects_timeout(client):
    node = register_sample_node(client).json()
    age_heartbeat(client, node["id"], 3600)
    assert client.get(f"/api/v1/nodes/{node['id']}").json()["status"] == "DOWN"


def test_fresh_node_is_not_marked_down(client):
    node = register_sample_node(client).json()
    age_heartbeat(client, node["id"], 5)
    assert client.get("/api/v1/nodes").json()[0]["status"] == "ONLINE"


def test_heartbeat_revives_down_node(client):
    node = register_sample_node(client).json()
    age_heartbeat(client, node["id"], 3600)
    assert client.get("/api/v1/nodes").json()[0]["status"] == "DOWN"
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={"cpu_util_pct": 1, "ram_used_mb": 1, "gpus": []})
    assert client.get("/api/v1/nodes").json()[0]["status"] == "ONLINE"


def test_down_node_receives_no_jobs(client):
    node = register_sample_node(client).json()
    age_heartbeat(client, node["id"], 3600)
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1}).json()
    assert job["status"] == "QUEUED"


def test_lost_node_requeues_scheduled_jobs_and_fails_running_ones(client):
    node = register_sample_node(client).json()
    client.post("/api/v1/jobs", json={"name": "claimed", "gpu_count": 0})
    client.post("/api/v1/jobs", json={"name": "waiting", "gpu_count": 0})
    client.get(f"/api/v1/nodes/{node['id']}/jobs/next")  # agent claims the oldest -> RUNNING
    age_heartbeat(client, node["id"], 3600)
    client.get("/api/v1/nodes")  # triggers the sweep
    by_name = {j["name"]: j for j in client.get("/api/v1/jobs").json()}
    assert by_name["claimed"]["status"] == "FAILED"
    assert "lost" in by_name["claimed"]["state_reason"]
    assert by_name["waiting"]["status"] == "QUEUED" and by_name["waiting"]["node_id"] is None


def test_nodes_listed_in_natural_order_with_topology_fields(client):
    for host in ("gpu10", "gpu2", "gpu1"):
        register_sample_node(client, hostname=host)
    nodes = client.get("/api/v1/nodes").json()
    assert [n["hostname"] for n in nodes] == ["gpu1", "gpu2", "gpu10"]
    n = nodes[0]
    for key in ("id", "hostname", "ip_address", "status", "cpu_cores", "ram_total_mb", "gpus", "gpu_count",
                "gpus_free", "current_jobs", "last_heartbeat", "heartbeat_age_seconds"):
        assert key in n
    assert n["last_heartbeat"].endswith("Z")


def test_topology_endpoint_has_master_and_all_nodes(client):
    for i in range(5):
        register_sample_node(client, hostname=f"gpu0{i + 1}")
    topo = client.get("/api/v1/cluster/topology").json()
    assert topo["master"]["ip_address"] == "10.20.0.10"
    assert topo["master"]["scheduler"] == "dev"
    assert len(topo["nodes"]) == 5


def test_node_lists_its_current_jobs(client):
    node = register_sample_node(client).json()
    job = client.post("/api/v1/jobs", json={"name": "train", "gpu_count": 1}).json()
    shown = client.get(f"/api/v1/nodes/{node['id']}").json()
    assert [j["id"] for j in shown["current_jobs"]] == [job["id"]]
    assert shown["gpus_free"] == 0  # the only GPU is reserved by that job


def test_gpu_info_carries_temperature_and_identity(client):
    node = client.post("/api/v1/nodes/register", json={
        "hostname": "gpu09", "cpu_cores": 8, "ram_total_mb": 1024,
        "gpus": [{"name": "RTX 3060", "vram_total_mb": 12288, "index": 0, "uuid": "GPU-abc", "temperature_c": 61.0}],
    }).json()
    assert node["gpus"][0]["temperature_c"] == 61.0 and node["gpus"][0]["uuid"] == "GPU-abc"


def test_summary_counts_gpus_on_down_nodes_as_unavailable(client):
    up = register_sample_node(client, hostname="up").json()
    down = register_sample_node(client, hostname="down").json()
    age_heartbeat(client, down["id"], 3600)
    s = client.get("/api/v1/cluster/summary").json()
    assert (s["gpus_total"], s["gpus_idle"], s["gpus_unavailable"], s["gpus_allocated"]) == (2, 1, 1, 0)
    assert up["id"]


def test_node_metrics_snapshot_without_prometheus(client):
    node = register_sample_node(client).json()
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={
        "cpu_util_pct": 33.0, "ram_used_mb": 2048, "net_rx_mbps": 1.5, "net_tx_mbps": 0.5,
        "gpus": [{"name": "RTX 3060", "vram_total_mb": 12288, "vram_used_mb": 100, "utilization_pct": 12}]})
    m = client.get(f"/api/v1/nodes/{node['id']}/metrics").json()
    assert m["source"] == "heartbeat" and m["series"] is None
    assert m["cpu_util_pct"] == 33.0 and m["net_rx_mbps"] == 1.5 and m["gpus"][0]["utilization_pct"] == 12


def test_node_metrics_unknown_node_and_bad_range(client):
    assert client.get("/api/v1/nodes/nope/metrics").status_code == 404
    node = register_sample_node(client).json()
    assert client.get(f"/api/v1/nodes/{node['id']}/metrics?range=forever").status_code == 422


def test_root_aliases_serve_the_same_api(client):
    register_sample_node(client)
    assert client.get("/nodes").json() == client.get("/api/v1/nodes").json()
    assert client.get("/cluster/summary").status_code == 200
    assert client.get("/health").status_code == 200
