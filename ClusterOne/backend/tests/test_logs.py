"""Job log retrieval: tail, paging, search, timestamps, memory bounds, path safety."""
import io
import os

import pytest

from app.config import settings
from app.models import Job
from app.services import log_reader
from tests.test_nodes import register_sample_node


def make_log(n, ts=False):
    lines = []
    for i in range(1, n + 1):
        prefix = f"2026-01-01T00:00:{i % 60:02d}+0000 " if ts else ""
        lines.append(f"{prefix}line {i}")
    return ("\n".join(lines) + "\n").encode()


def read(data, **kw):
    return log_reader.read_logs(io.BytesIO(data), len(data), "j", "file", **kw)


def test_tail_returns_last_lines_with_absolute_numbers():
    res = read(make_log(1000), tail=5)
    assert [ln.text for ln in res.lines] == [f"line {i}" for i in range(996, 1001)]
    assert [ln.line for ln in res.lines] == list(range(996, 1001))
    assert res.total_lines == 1000 and res.truncated is True and res.mode == "tail"


def test_tail_of_short_log_returns_everything():
    res = read(make_log(3), tail=50)
    assert [ln.text for ln in res.lines] == ["line 1", "line 2", "line 3"] and res.truncated is False


def test_tail_handles_log_larger_than_one_block_and_no_trailing_newline():
    data = make_log(20000).rstrip(b"\n")  # ~200 KB, several 64 KB blocks
    res = read(data, tail=3)
    assert [ln.text for ln in res.lines] == ["line 19998", "line 19999", "line 20000"]
    assert res.lines[-1].line == 20000


def test_empty_log():
    res = read(b"", tail=10)
    assert res.lines == [] and res.total_lines == 0


def test_paging_walks_the_whole_file_without_gaps():
    data = make_log(25)
    seen, offset = [], 0
    while offset is not None:
        page = read(data, offset=offset, limit=10)
        seen += [ln.text for ln in page.lines]
        offset = page.next_offset
    assert seen == [f"line {i}" for i in range(1, 26)]


def test_search_is_case_insensitive_and_reports_line_numbers():
    data = b"alpha\nERROR: boom\nbeta\nerror again\ngamma\n"
    res = read(data, search="error")
    assert [(ln.line, ln.text) for ln in res.lines] == [(2, "ERROR: boom"), (4, "error again")]
    assert res.mode == "search" and not res.truncated


def test_search_truncates_and_continues(monkeypatch):
    data = b"hit\n" * 10
    first = read(data, search="hit", limit=4)
    assert len(first.lines) == 4 and first.truncated and first.next_offset == 4
    second = read(data, search="hit", limit=100, offset=first.next_offset)
    assert len(second.lines) == 6


def test_timestamps_are_parsed_and_can_be_hidden():
    data = make_log(3, ts=True)
    with_ts = read(data, tail=3)
    assert with_ts.lines[0].timestamp == "2026-01-01T00:00:01+0000" and with_ts.lines[0].text == "line 1"
    without = read(data, tail=3, timestamps=False)
    assert all(ln.timestamp is None for ln in without.lines) and without.lines[0].text == "line 1"


def test_logs_without_timestamps_have_none():
    assert read(make_log(2), tail=2).lines[0].timestamp is None


def test_overlong_lines_are_capped_and_do_not_blow_up_memory(monkeypatch):
    monkeypatch.setattr(settings, "log_max_line_bytes", 100)
    data = b"short\n" + b"x" * 1_000_000 + b"\nafter\n"
    for res in (read(data, offset=0, limit=10), read(data, tail=10)):
        texts = [ln.text for ln in res.lines]
        assert texts[0] == "short" and texts[-1] == "after"
        assert all(len(t) < 200 for t in texts)
    assert read(data, search="after").lines[0].text == "after"


def test_binary_garbage_does_not_crash():
    res = read(b"ok\n\xff\xfe\x00bad\nfine\n", tail=10)
    assert res.lines[0].text == "ok" and res.lines[-1].text == "fine"


def test_tail_does_not_read_whole_big_file(tmp_path, monkeypatch):
    path = tmp_path / "big.log"
    with open(path, "wb") as f:
        for _ in range(200):
            f.write(b"y" * 1023 + b"\n")  # 200 KB
        f.write(b"last line\n")
    reads = []
    real_open = open

    class Spy:
        def __init__(self, fh):
            self.fh = fh

        def read(self, n=-1):
            reads.append(n)
            return self.fh.read(n)

        def __getattr__(self, name):
            return getattr(self.fh, name)

    with real_open(path, "rb") as fh:
        size = os.fstat(fh.fileno()).st_size
        monkeypatch.setattr(log_reader, "_COUNT_LINES_MAX_BYTES", 0)  # skip the full count
        res = log_reader.read_logs(Spy(fh), size, "j", "file", tail=1)
    assert res.lines[0].text == "last line" and res.lines[0].line is None and res.total_lines is None
    assert max(reads) <= 64 * 1024 and len(reads) <= 3


# -- API ------------------------------------------------------------------
def run_job_with_output(client, text="first\nsecond\nthird\n"):
    node = register_sample_node(client).json()
    job = client.post("/api/v1/jobs", json={"name": "t", "gpu_count": 0}).json()
    client.get(f"/api/v1/nodes/{node['id']}/jobs/next")
    client.post(f"/api/v1/jobs/{job['id']}/report", json={"log_append": text})
    return job


def test_logs_endpoint_tail_page_search(client):
    job = run_job_with_output(client, "".join(f"step {i}\n" for i in range(1, 51)))
    url = f"/api/v1/jobs/{job['id']}/logs"
    tail = client.get(url + "?tail=3").json()
    assert [ln["text"] for ln in tail["lines"]] == ["step 48", "step 49", "step 50"]
    assert tail["lines"][0]["timestamp"].endswith("Z") and tail["source"] == "file"
    page = client.get(url + "?offset=10&limit=2").json()
    assert [ln["text"] for ln in page["lines"]] == ["step 11", "step 12"] and page["next_offset"] == 12
    hits = client.get(url + "?search=STEP 4").json()
    assert len(hits["lines"]) == 11  # step 4, step 40..49
    assert client.get(url + "?timestamps=false&tail=1").json()["lines"][0]["timestamp"] is None


def test_logs_appended_in_chunks_accumulate(client):
    job = run_job_with_output(client, "a\n")
    client.post(f"/api/v1/jobs/{job['id']}/report", json={"log_append": "b\nc\n"})
    lines = client.get(f"/api/v1/jobs/{job['id']}/logs").json()["lines"]
    assert [ln["text"] for ln in lines] == ["a", "b", "c"]
    assert client.get(f"/api/v1/jobs/{job['id']}").json()["logs"] == "a\nb\nc\n"


def test_db_log_mirror_is_bounded_but_file_is_complete(client, monkeypatch):
    monkeypatch.setattr(settings, "log_db_tail_bytes", 50)
    job = run_job_with_output(client, "".join(f"line {i}\n" for i in range(100)))
    assert len(client.get(f"/api/v1/jobs/{job['id']}").json()["logs"]) <= 50
    assert client.get(f"/api/v1/jobs/{job['id']}/logs?tail=1000").json()["total_lines"] == 100


def test_legacy_job_with_only_db_logs_is_still_readable(client):
    job = run_job_with_output(client, "x\n")
    os.remove(log_reader.dev_log_path(job["id"]))
    with client.session_factory() as db:
        db.get(Job, job["id"]).logs = "old one\nold two\n"
        db.commit()
    res = client.get(f"/api/v1/jobs/{job['id']}/logs").json()
    assert res["source"] == "database" and [ln["text"] for ln in res["lines"]] == ["old one", "old two"]


def test_job_without_output_returns_empty_not_error(client):
    job = client.post("/api/v1/jobs", json={"name": "t", "gpu_count": 0}).json()
    res = client.get(f"/api/v1/jobs/{job['id']}/logs")
    assert res.status_code == 200 and res.json()["lines"] == [] and res.json()["source"] == "none"
    assert client.get("/api/v1/jobs/nope/logs").status_code == 404


def test_logs_query_validation(client):
    job = run_job_with_output(client)
    base = f"/api/v1/jobs/{job['id']}/logs"
    assert client.get(base + "?tail=0").status_code == 422
    assert client.get(base + "?offset=-1").status_code == 422
    assert client.get(base + "?search=").status_code == 422


def test_tail_is_capped_by_configuration(client, monkeypatch):
    monkeypatch.setattr(settings, "log_tail_max_lines", 2)
    job = run_job_with_output(client)
    assert len(client.get(f"/api/v1/jobs/{job['id']}/logs?tail=100").json()["lines"]) == 2


# -- Slurm-mode path safety ----------------------------------------------
def slurm_job(path):
    return Job(id="j1", name="n", submitted_by="alice", slurm_job_id="9", log_path=path)


def test_slurm_log_inside_shared_storage_is_readable(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "slurm_enabled", True)
    monkeypatch.setattr(settings, "nfs_projects_root", str(tmp_path))
    log = tmp_path / "out.log"
    log.write_text("2026-01-01T00:00:00+0000 hello\n")
    res = log_reader.get_job_logs(slurm_job(str(log)))
    assert res.source == "file" and res.lines[0].text == "hello"


def test_slurm_log_outside_shared_storage_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "slurm_enabled", True)
    monkeypatch.setattr(settings, "nfs_projects_root", str(tmp_path / "share"))
    (tmp_path / "share").mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("top secret\n")
    res = log_reader.get_job_logs(slurm_job(str(secret)))
    assert res.source == "none" and res.lines == []


def test_slurm_log_symlink_escape_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "slurm_enabled", True)
    share = tmp_path / "share"
    share.mkdir()
    monkeypatch.setattr(settings, "nfs_projects_root", str(share))
    secret = tmp_path / "secret.txt"
    secret.write_text("top secret\n")
    link = share / "out.log"
    try:
        link.symlink_to(secret)
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not available")
    assert log_reader.get_job_logs(slurm_job(str(link))).lines == []
