"""Agent token, Keycloak/OIDC bearer tokens, and Prometheus-backed metrics (all mocked)."""
import json
import time

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic import SecretStr

from app import auth
from app.config import settings
from app.services import metrics
from tests.test_nodes import register_sample_node

# -- agent token ----------------------------------------------------------


def test_agent_endpoints_require_the_token_when_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "agent_token", SecretStr("s3cret"))
    body = {"hostname": "gpu01", "cpu_cores": 1, "ram_total_mb": 1}
    assert client.post("/api/v1/nodes/register", json=body).status_code == 401
    assert client.post("/api/v1/nodes/register", json=body, headers={"X-Agent-Token": "wrong"}).status_code == 401
    ok = client.post("/api/v1/nodes/register", json=body, headers={"X-Agent-Token": "s3cret"})
    assert ok.status_code == 200
    node_id = ok.json()["id"]
    hb = {"cpu_util_pct": 1, "ram_used_mb": 1, "gpus": []}
    assert client.post(f"/api/v1/nodes/{node_id}/heartbeat", json=hb).status_code == 401
    assert client.get(f"/api/v1/nodes/{node_id}/jobs/next").status_code == 401
    assert client.post("/api/v1/jobs/x/report", json={}).status_code == 401
    # Reading is not an agent operation.
    assert client.get("/api/v1/nodes").status_code == 200


# -- OIDC -----------------------------------------------------------------
@pytest.fixture()
def oidc(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "oidc_issuer_url", "https://sso.test/realms/clusterone")
    monkeypatch.setattr(settings, "oidc_audience", "clusterone-api")
    monkeypatch.setattr(auth, "_signing_key", lambda token: key.public_key())

    def make(username="alice", groups=(), **overrides):
        claims = {"preferred_username": username, "groups": list(groups), "iss": settings.oidc_issuer_url,
                  "aud": "clusterone-api", "exp": int(time.time()) + 300}
        claims.update(overrides)
        return {"Authorization": "Bearer " + jwt.encode(claims, key, algorithm="RS256")}

    return make


def test_requests_without_valid_token_are_401(client, oidc):
    assert client.get("/api/v1/nodes").status_code == 401
    assert client.get("/api/v1/nodes", headers={"Authorization": "Bearer garbage"}).status_code == 401
    assert client.get("/api/v1/nodes", headers=oidc(exp=int(time.time()) - 10)).status_code == 401
    assert client.get("/api/v1/nodes", headers=oidc(iss="https://evil/realms/x")).status_code == 401
    assert client.get("/api/v1/nodes", headers=oidc(aud="someone-else")).status_code == 401


def test_token_signed_with_another_key_is_rejected(client, oidc):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    bad = jwt.encode({"preferred_username": "mallory", "iss": settings.oidc_issuer_url, "aud": "clusterone-api",
                      "exp": int(time.time()) + 300}, other, algorithm="RS256")
    assert client.get("/api/v1/nodes", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_valid_token_works_and_summary_stays_public(client, oidc):
    assert client.get("/api/v1/nodes", headers=oidc()).status_code == 200
    assert client.get("/api/v1/cluster/summary").status_code == 200
    assert client.get("/health").status_code == 200


def test_submitter_identity_comes_from_the_token_not_the_body(client, oidc):
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 0, "submitted_by": "someone-else"},
                      headers=oidc("alice")).json()
    assert job["submitted_by"] == "alice"


def test_users_only_see_and_cancel_their_own_jobs(client, oidc):
    mine = client.post("/api/v1/jobs", json={"name": "mine", "gpu_count": 0}, headers=oidc("alice")).json()
    client.post("/api/v1/jobs", json={"name": "theirs", "gpu_count": 0}, headers=oidc("bob"))
    assert [j["name"] for j in client.get("/api/v1/jobs", headers=oidc("alice")).json()] == ["mine"]
    assert client.get(f"/api/v1/jobs/{mine['id']}", headers=oidc("bob")).status_code == 404
    assert client.post(f"/api/v1/jobs/{mine['id']}/cancel", headers=oidc("bob")).status_code == 404
    assert client.get(f"/api/v1/jobs/{mine['id']}/logs", headers=oidc("bob")).status_code == 404
    assert client.post(f"/api/v1/jobs/{mine['id']}/cancel", headers=oidc("alice")).json()["status"] == "CANCELLED"


def test_admin_group_sees_everything(client, oidc):
    mine = client.post("/api/v1/jobs", json={"name": "mine", "gpu_count": 0}, headers=oidc("alice")).json()
    admin = oidc("root", groups=["/clusterone-admins"])
    assert len(client.get("/api/v1/jobs", headers=admin).json()) == 1
    assert client.post(f"/api/v1/jobs/{mine['id']}/cancel", headers=admin).status_code == 200


# -- Prometheus -----------------------------------------------------------
def matrix(*series):
    return {"status": "success", "data": {"resultType": "matrix", "result": list(series)}}


@pytest.fixture()
def prom(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/-/healthy"):
            return httpx.Response(200, text="ok")
        calls.append(dict(request.url.params))
        q = request.url.params["query"]
        if "DCGM_FI_DEV_GPU_UTIL" in q:
            return httpx.Response(200, json=matrix(
                {"metric": {"gpu": "0"}, "values": [[1700000000, "55"], [1700000015, "60"]]},
                {"metric": {"gpu": "1"}, "values": [[1700000000, "NaN"], [1700000015, "10"]]}))
        if "node_cpu_seconds_total" in q:
            return httpx.Response(200, json=matrix({"metric": {}, "values": [[1700000000, "12.5"]]}))
        return httpx.Response(200, json=matrix())

    monkeypatch.setattr(settings, "prometheus_url", "http://prom.test:9090")
    monkeypatch.setattr(metrics.prometheus, "transport", httpx.MockTransport(handler))
    yield calls
    monkeypatch.setattr(metrics.prometheus, "transport", None)


def test_node_metrics_come_from_prometheus_when_configured(client, prom):
    node = register_sample_node(client).json()
    m = client.get(f"/api/v1/nodes/{node['id']}/metrics?range=1h&step=1m").json()
    assert m["source"] == "prometheus"
    assert [p["v"] for p in m["series"]["gpu0_util_pct"]] == [55.0, 60.0]
    assert [p["v"] for p in m["series"]["gpu1_util_pct"]] == [10.0]  # NaN dropped
    assert m["series"]["cpu_util_pct"][0]["v"] == 12.5
    assert m["gpus"]  # latest heartbeat values are still present
    assert any('instance=~"^(10\\.20\\.0\\.11|gpu01)(:[0-9]+)?$"' in c["query"] for c in prom)
    assert all(int(c["end"].split(".")[0]) - int(c["start"].split(".")[0]) == 3600 for c in prom)


def test_prometheus_down_falls_back_to_heartbeat(client, monkeypatch):
    monkeypatch.setattr(settings, "prometheus_url", "http://prom.test:9090")
    monkeypatch.setattr(metrics.prometheus, "transport",
                        httpx.MockTransport(lambda r: httpx.Response(503, text="down")))
    node = register_sample_node(client).json()
    m = client.get(f"/api/v1/nodes/{node['id']}/metrics").json()
    assert m["source"] == "heartbeat" and m["series"] is None and "Prometheus unavailable" in m["message"]
    monkeypatch.setattr(metrics.prometheus, "transport", None)


def test_hostile_hostnames_cannot_inject_promql():
    from app.models import Node
    assert metrics._matcher(Node(hostname='a"} or vector(1) #', ip_address=None)) is None


def test_job_metrics_use_the_job_window(client, prom):
    node = register_sample_node(client).json()
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1}).json()
    client.get(f"/api/v1/nodes/{node['id']}/jobs/next")
    m = client.get(f"/api/v1/jobs/{job['id']}/metrics").json()
    assert m["node"]["source"] == "prometheus" and "gpu0_util_pct" in m["node"]["series"]


def test_health_reports_prometheus(client, prom):
    h = client.get("/health").json()
    assert h["prometheus"]["configured"] is True


def test_parse_duration():
    assert metrics.parse_duration("90s") == 90 and metrics.parse_duration("15m") == 900
    assert metrics.parse_duration("2d") == 172800
    with pytest.raises(ValueError):
        metrics.parse_duration("15")


_ = json  # (kept for ad-hoc debugging of mocked payloads)


# -- shared API key (LAN deployments without Keycloak) --------------------------------------------------
def test_api_key_protects_user_endpoints_but_not_health_or_summary(client, monkeypatch):
    monkeypatch.setattr(settings, "api_key", SecretStr("k3y"))
    assert client.get("/api/v1/nodes").status_code == 401
    assert client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 0, "command": "x"}).status_code == 401
    assert client.get("/api/v1/nodes", headers={"X-API-Key": "wrong"}).status_code == 401
    assert client.get("/api/v1/nodes", headers={"X-API-Key": "k3y"}).status_code == 200
    assert client.get("/api/v1/nodes", headers={"Authorization": "Bearer k3y"}).status_code == 200  # the web UI's style
    assert client.get("/health").status_code == 200 and client.get("/api/v1/cluster/summary").status_code == 200


def test_api_key_does_not_replace_the_agent_token(client, monkeypatch):
    monkeypatch.setattr(settings, "api_key", SecretStr("k3y"))
    monkeypatch.setattr(settings, "agent_token", SecretStr("agent"))
    body = {"hostname": "gpu01", "cpu_cores": 1, "ram_total_mb": 1}
    assert client.post("/api/v1/nodes/register", json=body, headers={"X-API-Key": "k3y"}).status_code == 401
    assert client.post("/api/v1/nodes/register", json=body, headers={"X-Agent-Token": "agent"}).status_code == 200


def test_node_reports_capabilities_driver_cuda_and_availability(client):
    r = client.post("/api/v1/nodes/register", json={
        "hostname": "SOURAV", "ip_address": "192.168.0.105", "cpu_cores": 12, "ram_total_mb": 16000,
        "gpus": [{"name": "RTX 4050", "vram_total_mb": 6144, "driver_version": "572.16", "cuda_version": "12.8"}],
        "capabilities": {"python": "3.12.1", "torch": "2.6.0+cu124", "torch_cuda_available": True, "ffmpeg_nvenc": False}})
    node = r.json()
    assert node["availability"] == "AVAILABLE"
    assert node["gpus"][0]["driver_version"] == "572.16" and node["gpus"][0]["cuda_version"] == "12.8"
    assert node["capabilities"]["torch_cuda_available"] is True
    # A later heartbeat (which carries no capabilities) must not erase them.
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={"cpu_util_pct": 1, "ram_used_mb": 1, "gpus": node["gpus"]})
    assert client.get(f"/api/v1/nodes/{node['id']}").json()["capabilities"]["torch"] == "2.6.0+cu124"


def test_availability_states(client):
    from tests.test_node_lifecycle import age_heartbeat

    gpu = {"name": "RTX", "vram_total_mb": 6144}
    free = client.post("/api/v1/nodes/register", json={"hostname": "free", "cpu_cores": 4, "ram_total_mb": 8000, "gpus": [gpu]}).json()
    nogpu = client.post("/api/v1/nodes/register", json={"hostname": "nogpu", "cpu_cores": 4, "ram_total_mb": 8000, "gpus": []}).json()
    gone = client.post("/api/v1/nodes/register", json={"hostname": "gone", "cpu_cores": 4, "ram_total_mb": 8000, "gpus": [gpu]}).json()
    age_heartbeat(client, gone["id"], 3600)
    states = {n["hostname"]: n["availability"] for n in client.get("/api/v1/nodes").json()}
    assert states == {"free": "AVAILABLE", "nogpu": "ERROR", "gone": "OFFLINE"}
    client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1, "command": "x", "node_id": free["id"]})
    assert {n["hostname"]: n["availability"] for n in client.get("/api/v1/nodes").json()}["free"] == "BUSY"
    assert nogpu["id"]
