#!/usr/bin/env bash
# ==============================================================================
# ClusterOne GPU Node Agent One-Line Installer
# ==============================================================================
set -e

CONTROLLER_URL="${CONTROLLER_URL:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-c1-node-secret-prod}"
INSTALL_DIR="/opt/clusterone-agent"

echo "=========================================================="
echo " Installing ClusterOne Production GPU Node Agent"
echo " Controller: ${CONTROLLER_URL}"
echo " Target Dir: ${INSTALL_DIR}"
echo "=========================================================="

# 1. Check Python
if ! command -v python3 &>/dev/null; then
    echo "[!] Python3 not found. Installing python3..."
    if command -v apt-get &>/dev/null; then
        apt-get update -qq && apt-get install -y -qq python3 python3-pip
    elif command -v yum &>/dev/null; then
        yum install -y -q python3 python3-pip
    fi
fi

# 2. Check NVIDIA driver / NVML
echo "[*] Checking NVIDIA GPU subsystem..."
if command -v nvidia-smi &>/dev/null; then
    echo "[✓] nvidia-smi detected:"
    nvidia-smi --query-gpu=name,driver_version --format=csv,noheader || true
    echo "[*] Installing pynvml bindings for direct C-level NVML query..."
    pip3 install --quiet pynvml || true
else
    echo "[!] Warning: nvidia-smi not found in PATH. Node will run in CPU-telemetry mode until NVIDIA drivers are loaded."
fi

# 3. Create install dir
mkdir -p "${INSTALL_DIR}"
cat << 'EOF' > "${INSTALL_DIR}/gpu_node_agent.py"
# (Agent code will be fetched or copied directly)
EOF

# Download latest agent script from controller API
echo "[*] Fetching agent source from controller..."
curl -sSL "${CONTROLLER_URL}/agent/gpu_node_agent.py" -o "${INSTALL_DIR}/gpu_node_agent.py" || {
    echo "[!] Could not fetch from URL directly, using local copy if present"
}
chmod +x "${INSTALL_DIR}/gpu_node_agent.py"

# 4. Create systemd service
echo "[*] Creating systemd service unit /etc/systemd/system/gpu-node-agent.service..."
cat << EOF > /etc/systemd/system/gpu-node-agent.service
[Unit]
Description=ClusterOne GPU Cluster Node Telemetry Agent
After=network.target nvidia-persistenced.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment="CONTROLLER_URL=${CONTROLLER_URL}"
Environment="AGENT_AUTH_TOKEN=${AUTH_TOKEN}"
Environment="TELEMETRY_INTERVAL=1.0"
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/gpu_node_agent.py
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

# 5. Reload and start systemd service
if command -v systemctl &>/dev/null; then
    systemctl daemon-reload
    systemctl enable gpu-node-agent.service
    systemctl restart gpu-node-agent.service
    echo "[✓] gpu-node-agent service enabled and started!"
    echo "Check status with: systemctl status gpu-node-agent"
else
    echo "[*] Non-systemd system detected. Run agent manually in background:"
    echo "nohup python3 ${INSTALL_DIR}/gpu_node_agent.py --server ${CONTROLLER_URL} --token ${AUTH_TOKEN} > /var/log/gpu-agent.log 2>&1 &"
fi

echo "=========================================================="
echo " Installation Complete! Node will appear in Dashboard."
echo "=========================================================="
