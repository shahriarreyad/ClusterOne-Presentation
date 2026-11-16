import React, { useState, useMemo } from 'react';
import { NodeProfile, NodeStatus } from '../types';
import { 
  Server, 
  Search, 
  Filter, 
  Cpu, 
  Zap, 
  ArrowRight,
  HardDrive,
  DownloadCloud
} from 'lucide-react';

interface NodesPageProps {
  nodes: NodeProfile[];
  onSelectNode: (nodeId: string) => void;
  onOpenAgentModal: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const NodesPage: React.FC<NodesPageProps> = ({
  nodes,
  onSelectNode,
  onOpenAgentModal,
  searchQuery,
  onSearchChange,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | NodeStatus>('ALL');

  // Filter nodes dynamically from live telemetry
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      if (statusFilter !== 'ALL' && node.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchHost = node.hostname.toLowerCase().includes(q);
      const matchId = node.id.toLowerCase().includes(q);
      const matchIp = node.ip.toLowerCase().includes(q);
      const matchGpu = node.gpus?.some(g => g.name.toLowerCase().includes(q) || g.uuid.toLowerCase().includes(q));

      return matchHost || matchId || matchIp || matchGpu;
    });
  }, [nodes, statusFilter, searchQuery]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/90 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            Node Infrastructure Inventory ({filteredNodes.length} / {nodes.length})
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-0.5">
            Physical and virtual GPU host agents streaming live telemetry to ClusterOne
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search hostname, IP, GPU..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 w-48 sm:w-56"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All States ({nodes.length})</option>
            <option value="ONLINE">ONLINE Only</option>
            <option value="STALE">STALE Only</option>
            <option value="OFFLINE">OFFLINE Only</option>
          </select>

          <button
            onClick={onOpenAgentModal}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Connect Node</span>
          </button>
        </div>
      </div>

      {/* Nodes Table / Grid */}
      {filteredNodes.length === 0 ? (
        <div className="bg-zinc-950/90 rounded-2xl border border-dashed border-zinc-800 p-8 text-center space-y-3">
          <Server className="w-8 h-8 text-zinc-600 mx-auto" />
          <div className="text-sm font-bold text-zinc-300 font-mono">No nodes matching your query.</div>
          <p className="text-xs text-zinc-500 font-mono max-w-md mx-auto">
            Try adjusting your search criteria or register a new server by installing the Node Agent.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNodes.map((node) => {
            const hasGpus = node.gpus && node.gpus.length > 0;
            const avgGpu = hasGpus ? Math.round(node.gpus.reduce((acc, g) => acc + g.utilizationGpu, 0) / node.gpus.length) : 0;
            const totalVramUsed = hasGpus ? node.gpus.reduce((acc, g) => acc + g.vramUsedMb, 0) : 0;
            const totalVramTotal = hasGpus ? node.gpus.reduce((acc, g) => acc + g.vramTotalMb, 0) : 0;
            const vramPct = totalVramTotal > 0 ? Math.round((totalVramUsed / totalVramTotal) * 100) : 0;
            const maxTemp = hasGpus ? Math.max(...node.gpus.map(g => g.temperatureC)) : node.cpu.temperatureC || 40;

            return (
              <div
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className="bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-lg space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="min-w-0">
                    <span className="font-bold text-white font-mono text-sm block truncate">{node.hostname}</span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {node.ip} &bull; {node.isLocalHost ? 'Local Agent' : 'Remote Agent'}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    node.status === 'ONLINE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' :
                    node.status === 'STALE' ? 'bg-amber-950 text-amber-400 border border-amber-500/30' :
                    'bg-rose-950 text-rose-400 border border-rose-500/30'
                  }`}>
                    {node.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>Accelerators:</span>
                    <span className="font-bold text-white">
                      {hasGpus ? `${node.gpus.length} GPUs (${avgGpu}% util)` : '0 GPUs (CPU only)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>VRAM Pool:</span>
                    <span className="font-bold text-white">
                      {hasGpus ? `${(totalVramUsed / 1024).toFixed(1)} / ${(totalVramTotal / 1024).toFixed(0)} GB (${vramPct}%)` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Host CPU & RAM:</span>
                    <span className="font-bold text-white">
                      CPU {node.cpu.utilization}% &bull; RAM {node.ram.usedGb}/{node.ram.totalGb}G
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>OS / Kernel:</span>
                    <span className="font-bold text-zinc-300 truncate max-w-[200px]">{node.os}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>Heartbeat: {node.lastHeartbeatTime}</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    Details <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
