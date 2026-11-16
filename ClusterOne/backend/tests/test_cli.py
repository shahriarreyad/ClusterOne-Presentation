"""The laptop-side `clusterone_cli.py`: what it sends, how it streams, how it cancels."""
import argparse
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "clusterone_cli.py"


@pytest.fixture(scope="module")
def cli():
    spec = importlib.util.spec_from_file_location("clusterone_cli", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["clusterone_cli"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(autouse=True)
def _private_config(tmp_path, monkeypatch, cli):
    monkeypatch.setattr(cli, "CONFIG_PATH", tmp_path / "cfg.json")


class FakeApi:
    """Canned ClusterOne API: records calls, serves nodes, one job and its log."""

    def __init__(self, log_lines=("hello", "world"), final="COMPLETED", exit_code=0, mode="dev", interrupt=False):
        self.calls = []
        self.log_lines, self.final, self.exit_code, self.mode, self.interrupt = list(log_lines), final, exit_code, mode, interrupt
        self.polls = 0

    def call(self, method, path, body=None):
        self.calls.append((method, path, body))
        if path == "/nodes":
            return [{"id": "n1", "hostname": "gpu02", "status": "ONLINE", "ip_address": "10.20.0.22", "gpu_count": 1,
                     "gpus": [{"name": "RTX 4090"}], "gpus_free": 1, "ram_total_mb": 65536, "ram_used_mb": 8192}]
        if path == "/nodes/n1":
            return {"id": "n1", "hostname": "gpu02", "status": "ONLINE", "ip_address": "10.20.0.22", "heartbeat_age_seconds": 1.0,
                    "gpus": [{"name": "RTX 4090", "utilization_pct": 87, "vram_used_mb": 18432, "vram_total_mb": 24576,
                              "temperature_c": 71}], "cpu_util_pct": 62, "cpu_cores": 16, "ram_used_mb": 8192,
                    "ram_total_mb": 65536, "current_jobs": [{"name": "train"}]}
        if path == "/cluster/summary":
            return {"mode": self.mode}
        if method == "POST" and path == "/jobs":
            return {"id": "abcdef12-0000", "node_hostname": "gpu02"}
        if path.endswith("/cancel"):
            return {"status": "CANCELLED"}
        if "/logs" in path:
            offset = int(path.split("offset=")[1].split("&")[0])
            lines = [{"text": t, "timestamp": "2026-01-01T00:00:00Z"} for t in self.log_lines[offset:]]
            return {"lines": lines, "next_offset": None}
        if path.startswith("/jobs/"):
            self.polls += 1
            if self.interrupt:
                raise KeyboardInterrupt
            return {"status": self.final if self.polls > 1 else "RUNNING", "exit_code": self.exit_code,
                    "node_hostname": "gpu02", "status_message": "CUDA out of memory" if self.final == "FAILED" else None}
        raise AssertionError(f"unexpected call {method} {path}")


def ns(**kw):
    base = dict(file=None, args=[], cmd=None, name=None, gpus=1, cpus=2, ram="2G", env=None, any_node=False,
                timestamps=False, hostname=None)
    base.update(kw)
    return argparse.Namespace(**base)


def test_script_payload_restores_argv_on_the_node(cli, tmp_path):
    source = "import sys\nprint(sys.argv)\n"
    payload = cli.build_run_payload(source, "train.py", ["train.py", "--epochs", "3"], "n1", 1, 2, "2G", {"X": "1"}, "alice")
    assert payload["node_id"] == "n1" and payload["gpu_count"] == 1 and payload["name"] == "train.py"
    assert payload["env"]["X"] == "1" and json.loads(payload["env"]["C1_ARGV"]) == ["train.py", "--epochs", "3"]
    # Execute exactly what the node would run, with the env the node would give it.
    f = tmp_path / "job.py"
    f.write_text(payload["script"], encoding="utf8")
    out = subprocess.run([sys.executable, str(f)], capture_output=True, text=True, check=True,
                         env={"C1_ARGV": payload["env"]["C1_ARGV"]}, timeout=30)
    assert out.stdout.strip() == "['train.py', '--epochs', '3']"


def test_user_code_starts_on_line_two(cli):
    assert cli.PRELUDE.count("\n") == 1


def test_oversized_script_is_refused_with_advice(cli):
    with pytest.raises(SystemExit) as e:
        cli.build_run_payload("x" * 20000, "big.py", ["big.py"], None, 1, 2, "2G", {}, "alice")
    assert "--cmd" in str(e.value)


def test_names_are_made_valid_for_the_api(cli):
    p = cli.build_cmd_payload("python x.py", "my model (v2).py", None, 0, 1, "1G", {}, "alice")
    assert p["name"] == "my-model--v2-.py"
    assert "node_id" not in p and p["command"] == "python x.py"


def test_env_parsing(cli):
    assert cli.parse_env(["A=1", "B=x=y"]) == {"A": "1", "B": "x=y"}
    with pytest.raises(SystemExit):
        cli.parse_env(["nope"])


def test_use_saves_the_node_and_status_reads_it(cli, capsys):
    api = FakeApi()
    cfg = {}
    assert cli.cmd_use(api, ns(hostname="gpu02"), cfg) == 0
    assert cli.load_config()["node_id"] == "n1"
    assert cli.cmd_status(api, ns(), cli.load_config()) == 0
    out = capsys.readouterr().out
    assert "RTX 4090" in out and "87% busy" in out and "18.0/24.0 GB" in out and "71 C" in out
    cli.cmd_use(api, ns(hostname="any"), cli.load_config())
    assert "node_id" not in cli.load_config()


def test_use_unknown_node_fails(cli):
    with pytest.raises(SystemExit):
        cli.cmd_use(FakeApi(), ns(hostname="nope"), {})


def test_run_file_streams_output_and_returns_success(cli, tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(cli.time, "sleep", lambda s: None)
    script = tmp_path / "train.py"
    script.write_text("print('hi')\n", encoding="utf8")
    api = FakeApi()
    rc = cli.cmd_run(api, ns(file=str(script), args=["--epochs", "3"]), {"node_id": "n1", "node": "gpu02"})
    out = capsys.readouterr().out
    assert rc == 0 and "hello" in out and "world" in out
    assert "TARGET NODE    : gpu02" in out and "EXECUTION NODE : gpu02" in out and "VERIFIED       : ran on gpu02, not on this PC" in out
    posted = next(c for c in api.calls if c[0] == "POST" and c[1] == "/jobs")[2]
    assert posted["node_id"] == "n1" and json.loads(posted["env"]["C1_ARGV"]) == ["train.py", "--epochs", "3"]


def test_run_failure_reports_reason_and_exit_code(cli, tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(cli.time, "sleep", lambda s: None)
    script = tmp_path / "t.py"
    script.write_text("1/0\n", encoding="utf8")
    rc = cli.cmd_run(FakeApi(final="FAILED", exit_code=1), ns(file=str(script)), {})
    assert rc == 1 and "CUDA out of memory" in capsys.readouterr().out


def test_ctrl_c_cancels_the_job_on_the_node(cli, tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(cli.time, "sleep", lambda s: None)
    script = tmp_path / "t.py"
    script.write_text("pass\n", encoding="utf8")
    api = FakeApi(interrupt=True)
    assert cli.cmd_run(api, ns(file=str(script)), {}) == 130
    assert ("POST", "/jobs/abcdef12-0000/cancel", None) in api.calls


def test_slurm_mode_requires_cmd_for_files(cli, tmp_path):
    script = tmp_path / "t.py"
    script.write_text("pass\n", encoding="utf8")
    with pytest.raises(SystemExit) as e:
        cli.cmd_run(FakeApi(mode="slurm"), ns(file=str(script)), {})
    assert "--cmd" in str(e.value)


def test_cmd_mode_works_in_slurm_mode(cli, monkeypatch):
    monkeypatch.setattr(cli.time, "sleep", lambda s: None)
    api = FakeApi(mode="slurm")
    assert cli.cmd_run(api, ns(cmd="python /projects/me/train.py"), {"node_id": "n1"}) == 0
    assert next(c for c in api.calls if c[1] == "/jobs" and c[0] == "POST")[2]["command"] == "python /projects/me/train.py"


def test_any_node_flag_ignores_the_chosen_node(cli, monkeypatch):
    monkeypatch.setattr(cli.time, "sleep", lambda s: None)
    api = FakeApi()
    cli.cmd_run(api, ns(cmd="echo hi", any_node=True), {"node_id": "n1"})
    assert "node_id" not in next(c for c in api.calls if c[1] == "/jobs" and c[0] == "POST")[2]


def test_nodes_listing_marks_the_chosen_node(cli, capsys):
    cli.cmd_nodes(FakeApi(), ns(), {"node_id": "n1"})
    out = capsys.readouterr().out
    assert out.splitlines()[0].startswith("*") and "gpu02" in out and "1 x RTX 4090" in out


def test_claim_and_release_use_the_chosen_node(cli, capsys):
    class Api(FakeApi):
        def call(self, method, path, body=None):
            if path.startswith("/nodes/n1/claim"):
                self.calls.append((method, path, body))
                return {"hostname": "gpu02", "reserved_by": "alice", "gpu_count": 1, "cpu_cores": 16, "ram_total_mb": 65536}
            return super().call(method, path, body)

    api = Api()
    assert cli.cmd_claim(api, ns(), {"node_id": "n1"}) == 0
    assert cli.cmd_release(api, ns(), {"node_id": "n1"}) == 0
    assert [c[0] for c in api.calls if "claim" in c[1]] == ["POST", "DELETE"]
    assert "reserved for alice" in capsys.readouterr().out
    with pytest.raises(SystemExit):
        cli.cmd_claim(api, ns(), {})


def test_forget_removes_a_node_and_clears_it_if_chosen(cli, capsys):
    class Api(FakeApi):
        def call(self, method, path, body=None):
            if method == "DELETE" and path == "/nodes/n1":
                self.calls.append((method, path, body))
                return {"removed": "gpu02"}
            return super().call(method, path, body)

    api = Api()
    cli.save_config({"node_id": "n1", "node": "gpu02"})
    assert cli.cmd_forget(api, ns(hostname="gpu02"), cli.load_config()) == 0
    assert ("DELETE", "/nodes/n1", None) in api.calls and "node_id" not in cli.load_config()
    with pytest.raises(SystemExit):
        cli.cmd_forget(api, ns(hostname="nope"), {})


# -- proof of where the job ran, and no silent fallback ----------------------------------------------------------
class ProofApi(FakeApi):
    def __init__(self, node_status="ONLINE", ran_on="gpu02", ran_ip="10.20.0.22", **kw):
        super().__init__(**kw)
        self.node_status, self.ran_on, self.ran_ip = node_status, ran_on, ran_ip

    def call(self, method, path, body=None):
        out = super().call(method, path, body)
        if path == "/nodes/n1":
            out = dict(out, status=self.node_status, availability="AVAILABLE" if self.node_status == "ONLINE" else "OFFLINE")
            out["gpus"] = [dict(out["gpus"][0], vram_total_mb=24576, driver_version="572.16", cuda_version="12.8")]
        if method == "GET" and path.startswith("/jobs/") and "/logs" not in path:
            out = dict(out, node_hostname=self.ran_on, node_ip=self.ran_ip, node_id="n1")
        return out


def test_offline_target_is_reported_and_nothing_is_submitted(cli, tmp_path, capsys):
    script = tmp_path / "t.py"
    script.write_text("pass\n", encoding="utf8")
    api = ProofApi(node_status="DOWN")
    with pytest.raises(SystemExit) as e:
        cli.cmd_run(api, ns(file=str(script)), {"node_id": "n1", "node": "gpu02"})
    out = capsys.readouterr().out
    assert e.value.code == 3
    assert "TARGET NODE: gpu02" in out and "STATUS: OFFLINE" in out and "Windows" in out and "Firewall" in out
    assert "NOT submitted" in out and "any other PC" in out
    assert not any(c[0] == "POST" and c[1] == "/jobs" for c in api.calls)  # never silently runs elsewhere


def test_any_node_flag_skips_the_target_check(cli, capsys, monkeypatch):
    monkeypatch.setattr(cli.time, "sleep", lambda s: None)
    api = ProofApi(node_status="DOWN")
    assert cli.cmd_run(api, ns(cmd="echo", any_node=True), {"node_id": "n1"}) == 0


def test_header_shows_gpu_driver_and_cuda_and_job_id(cli, capsys, monkeypatch):
    monkeypatch.setattr(cli.time, "sleep", lambda s: None)
    cli.cmd_run(ProofApi(), ns(cmd="echo"), {"node_id": "n1", "node": "gpu02"})
    out = capsys.readouterr().out
    assert "Submitting job..." in out and "Target     : gpu02 (10.20.0.22)" in out
    assert "RTX 4090  VRAM 24.0 GB  driver 572.16 CUDA 12.8" in out and "Job ID     : abcdef12-0000" in out


def test_running_on_this_very_pc_is_called_out(cli, capsys, monkeypatch):
    monkeypatch.setattr(cli.time, "sleep", lambda s: None)
    me = cli.socket.gethostname()
    cli.cmd_run(ProofApi(ran_on=me, ran_ip=None), ns(cmd="echo"), {"node_id": "n1"})
    out = capsys.readouterr().out
    assert "WARNING        : the execution node is THIS PC" in out and "VERIFIED" not in out


def test_ran_on_a_different_node_than_asked_is_called_out(cli, capsys, monkeypatch):
    monkeypatch.setattr(cli.time, "sleep", lambda s: None)
    cli.cmd_run(ProofApi(ran_on="other", ran_ip="10.0.0.9"), ns(cmd="echo"), {"node_id": "n1"})
    assert "asked for gpu02 but it ran on other" in capsys.readouterr().out


def test_removed_target_node_gives_a_clear_error(cli):
    class Gone(FakeApi):
        def call(self, method, path, body=None):
            if path == "/nodes/n1":
                raise cli.CliError("GET /nodes/n1 -> 404: node not found")
            return super().call(method, path, body)

    with pytest.raises(SystemExit) as e:
        cli.cmd_run(Gone(), ns(cmd="echo"), {"node_id": "n1", "node": "gpu02"})
    assert "not known to the controller" in str(e.value) and "use <hostname>" in str(e.value)


# -- the scripts that get sent to a node -------------------------------------------------------------------------
SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"


def test_gpu_check_fails_clearly_without_pytorch_and_never_claims_a_pass():
    """Run for real in this environment (backend venv: no torch), so nothing touches a GPU."""
    out = subprocess.run([sys.executable, str(SCRIPTS_DIR / "gpu_check.py")], capture_output=True, text=True, timeout=60, check=False)
    assert out.returncode == 1
    assert "EXECUTION NODE :" in out.stdout and "PyTorch is NOT installed" in out.stdout
    assert "TEST: FAILED" in out.stdout and "TEST: PASSED" not in out.stdout


def test_gpu_check_script_contains_the_real_checks():
    src = (SCRIPTS_DIR / "gpu_check.py").read_text(encoding="utf8")
    for needle in ("torch.cuda.is_available()", "get_device_properties", "mem_get_info", "GPU matches CPU reference",
                   "5000, 5000", "GPU computation successful", "TEST: PASSED", "EXECUTION NODE"):
        assert needle in src


def test_ffmpeg_check_fails_clearly_when_ffmpeg_is_missing(monkeypatch):
    out = subprocess.run([sys.executable, str(SCRIPTS_DIR / "ffmpeg_gpu_check.py")], capture_output=True, text=True,
                         timeout=60, check=False, env={"PATH": "", "SYSTEMROOT": os.environ.get("SYSTEMROOT", "")})
    assert out.returncode == 1 and "EXECUTION NODE :" in out.stdout
    assert "ffmpeg is not installed" in out.stdout and "TEST: PASSED" not in out.stdout


def test_report_only_target_is_refused_before_submitting(cli, tmp_path, capsys):
    class ReportOnly(ProofApi):
        def call(self, method, path, body=None):
            out = super().call(method, path, body)
            return dict(out, capabilities={"accepts_jobs": False}) if path == "/nodes/n1" else out

    script = tmp_path / "t.py"
    script.write_text("pass\n", encoding="utf8")
    api = ReportOnly()
    with pytest.raises(SystemExit) as e:
        cli.cmd_run(api, ns(file=str(script)), {"node_id": "n1", "node": "gpu02"})
    out = capsys.readouterr().out
    assert e.value.code == 3 and "REPORT-ONLY" in out and "--no-jobs" in out and "NOT submitted" in out
    assert not any(c[0] == "POST" and c[1] == "/jobs" for c in api.calls)
