import React, { useState } from 'react';
import { X, Copy, Check, Rocket, Terminal, CheckCircle2, Shield, Network, Server, HardDrive } from 'lucide-react';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  controllerUrl: string;
  nodeHostname: string;
}

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({
  isOpen,
  onClose,
  controllerUrl,
  nodeHostname,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const installOneLiner = `curl -sSL https://clusterone.internal/agent/install.sh | sudo bash -s -- --controller "${controllerUrl}" --secret "c1-node-secret-prod-token"`;

  const yamlConfig = `# /etc/clusterone/agent.yaml
agent:
  version: "1.2.0"
  node_id: "${nodeHostname.split('.')[0]}"
  hostname: "${nodeHostname}"
  environment: "production"

controller:
  url: "${controllerUrl}"
  heartbeat_interval_sec: 5
  timeout_sec: 4
  auth_token_file: "/etc/clusterone/token.secret"

collector:
  gpu_driver: "nvml"         # nvml, rocm, mock
  nvml_sample_interval_ms: 500
  disk_mounts:
    - "/"
    - "/scratch"
    - "/datasets"
    - "/home"
  network_interface: "auto"  # auto-detect active default route (eth0/ib0)

supervisor:
  container_runtime: "apptainer"
  sandbox_scratch_dir: "/scratch/jobs"
  enable_nv_gpu_passthrough: true
  max_concurrent_tasks: 8
  cgroup_v2_isolation: true
`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Compute Node Agent — Production Deployment Guide</h3>
              <p className="text-xs text-zinc-400 font-mono">
                Standard operating runbook for deploying and operating the daemon on bare-metal GPU hosts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6 text-xs text-zinc-300 font-mono">
          {/* Step 1: Automated 1-Liner */}
          <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px] font-bold">1</span>
                Automated 1-Line Host Provisioning
              </span>
              <button
                onClick={() => copyToClipboard(installOneLiner, 1)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedIndex === 1 ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-zinc-400 text-[11px] mb-2 font-sans">
              Installs Python virtualenv, pynvml, psutil, apptainer, and registers the systemd unit automatically.
            </p>
            <pre className="p-3 bg-black rounded-lg border border-zinc-800 text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all">
              {installOneLiner}
            </pre>
          </div>

          {/* Step 2: Configuration */}
          <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px] font-bold">2</span>
                Production Agent Configuration (/etc/clusterone/agent.yaml)
              </span>
              <button
                onClick={() => copyToClipboard(yamlConfig, 2)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                {copiedIndex === 2 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedIndex === 2 ? 'Copied' : 'Copy YAML'}</span>
              </button>
            </div>
            <pre className="p-3 bg-black rounded-lg border border-zinc-800 text-zinc-300 overflow-x-auto">
              {yamlConfig}
            </pre>
          </div>

          {/* Step 3: Service Lifecycle */}
          <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px] font-bold">3</span>
              Systemd Lifecycle & Real-Time Journalctl Monitoring
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
              <div className="bg-black/90 p-2.5 rounded border border-zinc-800">
                <div className="text-zinc-500 mb-1"># Service reload and status</div>
                <div className="text-emerald-400">sudo systemctl restart clusterone-agent</div>
                <div className="text-zinc-300 mt-1">sudo systemctl status clusterone-agent</div>
              </div>
              <div className="bg-black/90 p-2.5 rounded border border-zinc-800">
                <div className="text-zinc-500 mb-1"># Live streaming logs</div>
                <div className="text-emerald-400">journalctl -u clusterone-agent -f -n 50</div>
                <div className="text-zinc-300 mt-1">tail -f /var/log/clusterone-agent.log</div>
              </div>
            </div>
          </div>

          {/* Step 4: Network & Security Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-1.5 text-white font-bold text-[11px] mb-1">
                <Network className="w-3.5 h-3.5 text-blue-400" />
                Network Ingress
              </div>
              <p className="text-zinc-400 text-[10px]">
                TCP 8080 (REST egress to Controller)<br />
                TCP 2049 (NFS /datasets mount)
              </p>
            </div>

            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-1.5 text-white font-bold text-[11px] mb-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                OWASP Top 10 Hardened
              </div>
              <p className="text-zinc-400 text-[10px]">
                Token in 0600 file &bull; mTLS 1.3<br />
                Systemd sandbox &bull; SSRF defense
              </p>
            </div>

            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-1.5 text-white font-bold text-[11px] mb-1">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                Storage Layout
              </div>
              <p className="text-zinc-400 text-[10px]">
                /scratch on NVMe (min 500GB)<br />
                /datasets on Read-Only NFS
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>Target Platform: Ubuntu 22.04 / 24.04 LTS &bull; NVIDIA Driver 535+ &bull; Apptainer 1.2+</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
