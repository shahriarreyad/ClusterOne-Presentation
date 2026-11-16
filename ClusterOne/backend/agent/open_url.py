"""Open a web page in Edge/Chrome on THIS machine for a while, using its GPU and RAM.
Usage: python open_url.py <url> [seconds]
"""
import os
import subprocess
import sys
import tempfile
import time

url = sys.argv[1] if len(sys.argv) > 1 else "https://www.youtube.com"
seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 120
candidates = [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Google\Chrome\Application\chrome.exe"]
exe = next((c for c in candidates if os.path.exists(c)), None)
if not exe:
    print("No Edge/Chrome found on this machine.", flush=True)
    sys.exit(1)
try:  # laptops: run the browser on the high-performance (NVIDIA) GPU
    import winreg
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\DirectX\UserGpuPreferences") as k:
        winreg.SetValueEx(k, exe, 0, winreg.REG_SZ, "GpuPreference=2;")
except Exception as e:
    print("could not set GPU preference:", e, flush=True)
print(f"Opening {url} in {os.path.basename(exe)} for {seconds:.0f}s", flush=True)
profile = tempfile.mkdtemp(prefix="c1url_")
proc = subprocess.Popen([exe, f"--user-data-dir={profile}", "--no-first-run", "--new-window", url])
time.sleep(seconds)
subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
print("Closed.", flush=True)
