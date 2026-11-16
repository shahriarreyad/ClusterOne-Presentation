"""Check that a ClusterOne node can do GPU video encoding (FFmpeg + NVIDIA NVENC). Runs ON the node.

    python scripts/clusterone_cli.py run scripts/ffmpeg_gpu_check.py

This is the realistic way to put a remote GPU to work on video: send the *job* (encode / transcode a file) to the
node, rather than trying to render a local browser or player on a remote GPU. It needs FFmpeg with NVENC on the node.
It encodes 3 seconds of a synthetic test picture with the GPU encoder and reports whether that worked.
"""
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path


def fail(reason):
    print(f"TEST: FAILED ({reason})")
    sys.exit(1)


print("=== ClusterOne FFmpeg GPU check ===")
print(f"EXECUTION NODE : {socket.gethostname()}")

ffmpeg = shutil.which("ffmpeg")
if not ffmpeg:
    fail("ffmpeg is not installed on this node (install an FFmpeg build with NVENC, e.g. from gyan.dev or BtbN)")
print(f"ffmpeg         : {ffmpeg}")

enc = subprocess.run([ffmpeg, "-hide_banner", "-encoders"], capture_output=True, text=True, timeout=30, check=False).stdout
if "h264_nvenc" not in enc:
    fail("this FFmpeg build has no h264_nvenc encoder (needs an NVENC-enabled build)")
print("NVENC encoder  : h264_nvenc present")

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "test.mp4"
    r = subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30",
         "-t", "3", "-c:v", "h264_nvenc", "-y", str(out)],
        capture_output=True, text=True, timeout=120, check=False)
    if r.returncode != 0 or not out.exists() or out.stat().st_size == 0:
        fail("GPU encode failed: " + (r.stderr.strip().splitlines() or ["unknown error"])[-1])
    print(f"GPU encode     : 3 s of 1080p30 encoded with h264_nvenc ({out.stat().st_size / 1024:.0f} KB)")

print("TEST: PASSED")
