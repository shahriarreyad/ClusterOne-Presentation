import React, { useState } from 'react';
import { 
  X, 
  Terminal, 
  Copy, 
  Check, 
  DownloadCloud, 
  ShieldCheck, 
  Server, 
  FileCode,
  Zap,
  Activity
} from 'lucide-react';

interface AgentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  registeredNodesCount: number;
}

export const AgentSetupModal: React.FC<AgentSetupModalProps> = ({
  isOpen,
  onClose,
  registeredNodesCount,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const curlCommand = `curl -sSL ${origin}/api/v1/agent/install.sh | sudo CONTROLLER_URL="${origin}" AUTH_TOKEN="c1-node-secret-prod" bash`;
  const manualCommand = `wget ${origin}/agent/gpu_node_agent.py
pip3 install pynvml
python3 gpu_node_agent.py --server ${origin} --token c1-node-secret-prod`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-4 p-6 my-8 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DownloadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Connect Physical or Virtual GPU Nodes
              </h2>
              <p className="text-xs font-mono text-zinc-400">
                Deploy the lightweight ClusterOne Node Agent with direct NVML C-bindings
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Listening Banner */}
        <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Controller is actively listening on <code className="text-white font-bold">/api/v1/telemetry</code></span>
          </div>
          <span className="text-[11px] text-zinc-400">
            {registeredNodesCount} Node{registeredNodesCount === 1 ? '' : 's'} registered in store
          </span>
        </div>

        {/* Method 1: Automatic One-Line Install Script */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Method 1: One-Line Systemd Installer (Recommended)
            </span>
            <button
              onClick={() => copyToClipboard(curlCommand, 'curl')}
              className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-300 flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'curl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === 'curl' ? 'Copied!' : 'Copy Script'}</span>
            </button>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all">
            {curlCommand}
          </div>
          <p className="text-[11px] font-mono text-zinc-500">
            Automatically detects NVIDIA driver, installs pynvml, writes <code>/etc/systemd/system/gpu-node-agent.service</code>, and enables autostart on boot.
          </p>
        </div>

        {/* Method 2: Manual Python Execution */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              Method 2: Standalone CLI Runner (No Root Required)
            </span>
            <button
              onClick={() => copyToClipboard(manualCommand, 'manual')}
              className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-300 flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'manual' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === 'manual' ? 'Copied!' : 'Copy Commands'}</span>
            </button>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-zinc-200 overflow-x-auto whitespace-pre">
            {manualCommand}
          </div>
        </div>

        {/* Troubleshooting / Verification */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 space-y-2 text-xs font-mono">
          <span className="font-bold text-zinc-300 uppercase tracking-wider text-[11px]">
            Verification & Service Commands:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-zinc-400">
            <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
              <span className="text-zinc-500 block text-[10px]">Check Agent Status:</span>
              <code className="text-zinc-200 text-[11px]">systemctl status gpu-node-agent</code>
            </div>
            <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
              <span className="text-zinc-500 block text-[10px]">Follow Real-Time Logs:</span>
              <code className="text-zinc-200 text-[11px]">journalctl -u gpu-node-agent -f</code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-end border-t border-zinc-800/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
