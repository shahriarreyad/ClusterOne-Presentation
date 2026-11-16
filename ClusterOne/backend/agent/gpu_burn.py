"""Put a real load on this PC's GPU for a while. Usage: python gpu_burn.py [seconds] [load%]

Uses PyTorch/CUDA if installed (NVIDIA). Otherwise opens gpu_stress.html in
Edge/Chrome, which loads whichever GPU the browser uses, and closes it after.
"""
import os
import subprocess
import sys
import tempfile
import time

seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 60
load = float(sys.argv[2]) if len(sys.argv) > 2 else 90


def torch_burn():
    import torch
    if not torch.cuda.is_available():
        return False
    print(f"Using CUDA on {torch.cuda.get_device_name(0)} for {seconds:.0f}s at ~{load:.0f}% load", flush=True)
    a = torch.randn(4096, 4096, device="cuda")
    end = time.time() + seconds
    while time.time() < end:
        slot_start = time.time()
        while time.time() - slot_start < 0.1 * load / 100:
            a = (a @ a).tanh()
            torch.cuda.synchronize()
        time.sleep(max(0.0, 0.1 - (time.time() - slot_start)))
    return True


def browser_burn():
    here = os.path.dirname(os.path.abspath(__file__))
    page = "file:///" + os.path.join(here, "gpu_stress.html").replace("\\", "/") + f"?load={load:.0f}"
    candidates = [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                  r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                  r"C:\Program Files\Google\Chrome\Application\chrome.exe"]
    exe = next((c for c in candidates if os.path.exists(c)), None)
    if not exe:
        print("No PyTorch/CUDA and no Edge/Chrome found; cannot create GPU load.", flush=True)
        sys.exit(1)
    try:  # laptops: make Windows run this browser on the high-performance (NVIDIA) GPU
        import winreg
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\DirectX\UserGpuPreferences") as k:
            winreg.SetValueEx(k, exe, 0, winreg.REG_SZ, "GpuPreference=2;")
    except Exception as e:
        print("could not set GPU preference:", e, flush=True)
    print(f"Using browser GPU load ({os.path.basename(exe)}) for {seconds:.0f}s at ~{load:.0f}%", flush=True)
    profile = tempfile.mkdtemp(prefix="c1burn_")
    proc = subprocess.Popen([exe, f"--user-data-dir={profile}", "--no-first-run", "--disable-background-timer-throttling",
                             "--disable-renderer-backgrounding", "--new-window", page])
    time.sleep(seconds)
    subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)


try:
    done = torch_burn()
except Exception:
    done = False
if not done:
    browser_burn()
print("GPU burn finished", flush=True)
