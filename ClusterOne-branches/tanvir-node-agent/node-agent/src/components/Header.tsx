import React from 'react';
import { 
  Server, 
  Power, 
  RotateCcw,
  Rocket
} from 'lucide-react';
import { NodeProfile, NodeStatus } from '../types';

interface HeaderProps {
  nodes: NodeProfile[];
  currentNode: NodeProfile;
  onSelectNode: (node: NodeProfile) => void;
  agentRunning: boolean;
  onToggleAgent: () => void;
  onRestartAgent: () => void;
  onOpenDeployModal: () => void;
  onOpenCodeModal?: () => void;
  onOpenJsonModal?: () => void;
  onOpenSecurityModal?: () => void;
  nodeStatus?: NodeStatus;
}

export const Header: React.FC<HeaderProps> = ({
  nodes,
  currentNode,
  onSelectNode,
  agentRunning,
  onToggleAgent,
  onRestartAgent,
  onOpenDeployModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3 w-full">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: App Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1.5 h-6 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30 shrink-0" />
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
            ClusterOne Node Agent
          </h1>
        </div>

        {/* Middle: Active Host Selector */}
        <div className="flex items-center gap-2 bg-zinc-900/90 px-2.5 py-1.5 rounded-xl border border-zinc-800 shrink-0">
          <Server className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <select 
            id="node-selector-dropdown"
            aria-label="Active Node Host"
            value={currentNode.id} 
            onChange={(e) => {
              const found = nodes.find(n => n.id === e.target.value);
              if (found) onSelectNode(found);
            }}
            className="bg-zinc-950 border border-zinc-700/80 text-zinc-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500 font-mono cursor-pointer max-w-[200px] sm:max-w-[260px] truncate"
          >
            {nodes.map(n => (
              <option key={n.id} value={n.id}>
                {n.hostname} ({n.gpus && n.gpus.length > 0 ? n.gpus[0].name.replace('NVIDIA GeForce ', '') : 'CPU Host'})
              </option>
            ))}
          </select>
        </div>

        {/* Right: Actions Bar */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            id="btn-open-deploy-guide"
            onClick={onOpenDeployModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 transition-colors shadow-sm cursor-pointer"
            title="Production Deployment Guide & Systemd Runbook"
          >
            <Rocket className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Deploy Guide</span>
            <span className="sm:hidden">Deploy</span>
          </button>

          <div className="h-5 w-px bg-zinc-800 mx-0.5 hidden sm:block" />

          <button
            id="btn-toggle-agent-power"
            onClick={onToggleAgent}
            className={`p-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              agentRunning 
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30' 
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}
            title={agentRunning ? "Stop Agent Service (simulate node offline)" : "Start Agent Service"}
          >
            <Power className="w-4 h-4" />
          </button>

          <button
            id="btn-restart-agent"
            onClick={onRestartAgent}
            disabled={!agentRunning}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
            title="Restart Agent Service (systemctl restart clusterone-agent)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
