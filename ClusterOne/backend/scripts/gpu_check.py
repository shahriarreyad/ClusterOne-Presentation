"""GPU check to send to a ClusterOne node. It really runs a computation on the GPU; it does not just ask nvidia-smi.

    python scripts/clusterone_cli.py use SOURAV
    python scripts/clusterone_cli.py run scripts/gpu_check.py

It runs ON the node, never on the PC you type this on. Success ends with:

    EXECUTION NODE : <the node's computer name>
    GPU            : <the node's GPU>
    TEST: PASSED

The check:
  1. Python and the GPU framework (PyTorch) are present
  2. a CUDA GPU is visible to PyTorch
  3. its model, VRAM (total and free) and driver are read
  4. a small matrix product on the GPU matches the same product on the CPU (so it is a correct GPU result)
  5. a large 5000x5000 product runs on the GPU and its result is printed (it goes back to the controller in the log)
Exit status is 0 only if all of it worked.
"""
import platform
import socket
import subprocess
import sys
import time


def fail(reason):
    print(f"TEST: FAILED ({reason})")
    sys.exit(1)


def driver_line():
    try:
        out = subprocess.run(["nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"],
                             capture_output=True, text=True, timeout=10, check=False).stdout.strip()
        return out.splitlines()[0] if out else "unknown"
    except Exception:
        return "unknown (nvidia-smi not available)"


print("=== ClusterOne GPU check ===")
print(f"EXECUTION NODE : {socket.gethostname()}")
print(f"Python         : {platform.python_version()} ({platform.system()} {platform.release()})")

try:
    import torch
except ImportError:
    print("Framework      : PyTorch is NOT installed on this node")
    fail("install the CUDA build of PyTorch on the node: https://pytorch.org")

print(f"Framework      : torch {torch.__version__} (built for CUDA {torch.version.cuda})")
print(f"CUDA available : {torch.cuda.is_available()}")
if not torch.cuda.is_available():
    fail("PyTorch cannot see a CUDA GPU here: CPU-only torch build, missing/old NVIDIA driver, or no NVIDIA GPU")

props = torch.cuda.get_device_properties(0)
free_b, total_b = torch.cuda.mem_get_info(0)
print(f"GPU            : {props.name}")
print(f"VRAM           : {total_b / 2**20:.0f} MB total, {free_b / 2**20:.0f} MB free")
print(f"Driver         : {driver_line()}   compute capability {props.major}.{props.minor}")

# A correct GPU result: same numbers as the CPU, on a size where a mistake would show.
torch.manual_seed(0)
a = torch.randn(256, 256)
b = torch.randn(256, 256)
cpu = a @ b
gpu = (a.cuda() @ b.cuda()).cpu()
max_err = (cpu - gpu).abs().max().item()
if max_err > 1e-2:
    fail(f"GPU result differs from the CPU reference (max error {max_err:.3g})")
print(f"Correctness    : GPU matches CPU reference (max error {max_err:.2e})")

x = torch.randn(5000, 5000, device="cuda")
torch.cuda.synchronize()
t = time.time()
y = x @ x
torch.cuda.synchronize()
print(f"Computation    : 5000x5000 matrix product on the GPU in {time.time() - t:.3f} s")
print("GPU computation successful")
print("Result:", y.mean().item())
print("TEST: PASSED")
