import React from 'react';
import { 
  NodeProfile, 
  ClusterKpis, 
  AlertRecord 
} from '../types';
import { 
  Server, 
  Cpu, 
  Zap, 
  Layers, 
  Activity, 
  BellRing, 
  HardDrive, 
  ArrowRight,
  Flame,
  CheckCircle2,
  AlertTriangle,
  DownloadCloud,
  Thermometer,
  ShieldCheck
} from 'lucide-react';

interface ClusterOverviewPageProps {
  nodes: NodeProfile[];
  kpis: ClusterKpis;
  alerts: AlertRecord[];
  onSelectNode: (nodeId: string) => void;
  onSelectGpu: (nodeId: string, gpuIndex: number) => void;
  onOpenAgentModal: () => void;
  onNavigate: (page: any) => void;
}

export const ClusterOverviewPage: React.FC<ClusterOverviewPageProps> = ({
  nodes,
  kpis,
  alerts,
  onSelectNode,
  onSelectGpu,
  onOpenAgentModal,
  onNavigate,
}) => {
  const hasGpus = kpis.totalGpus > 0;
  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE');

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Honest Empty State / Missing GPU Node Banner */}
      {!hasGpus && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  No Physical NVIDIA GPU Nodes Connected Yet
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400">
                  REAL TELEMETRY MODE
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-1 max-w-2xl leading-relaxed">
                The local container host is running in CPU telemetry mode. Connect your physical GPU server or cloud instance using the Node Agent to stream real NVML telemetry. No simulated or synthetic data is displayed.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenAgentModal}
            className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 transition-colors shrink-0 shadow-sm cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Connect GPU Node</span>
          </button>
        </div>
      )}

      {/* Real Top KPI Section (Section 6 of requirements) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Total Nodes */}
        <div className="bg-zinc-950/90 rounded-xl p-3.5 border border-zinc-800 space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>Total Nodes</span>
            <Server className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {kpis.totalNodes}
          </div>
          <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5 pt-0.5">
            <span className="text-emerald-400 font-bold">{kpis.onlineNodes} online</span>
            {kpis.offlineNodes > 0 && <span className="text-rose-400">&bull; {kpis.offlineNodes} offline</span>}
          </div>
        </div>

        {/* KPI 2: Total GPUs */}
        <div className="bg-zinc-950/90 rounded-xl p-3.5 border border-zinc-800 space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>Total GPUs</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {hasGpus ? kpis.totalGpus : '—'}
          </div>
          <div className="text-[10px] font-mono text-zinc-400">
            {hasGpus ? `${kpis.gpusInUse} in use · ${kpis.availableGpus} idle` : 'Telemetry unavailable'}
          </div>
        </div>

        {/* KPI 3: Cluster GPU Utilization */}
        <div className="bg-zinc-950/90 rounded-xl p-3.5 border border-zinc-800 space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>Cluster GPU Load</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {hasGpus ? `${kpis.clusterGpuUtilization}%` : '—'}
          </div>
          <div className="text-[10px] font-mono text-zinc-400">
            {hasGpus ? 'Across all accelerators' : 'Telemetry unavailable'}
          </div>
        </div>

        {/* KPI 4: Total VRAM Fabric */}
        <div className="bg-zinc-950/90 rounded-xl p-3.5 border border-zinc-800 space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>Total VRAM</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white truncate">
            {hasGpus ? (
              <>
                {(kpis.totalVramUsedMb / 1024).toFixed(1)}{' '}
                <span className="text-xs text-zinc-400 font-normal">/ {(kpis.totalVramTotalMb / 1024).toFixed(0)} GB</span>
              </>
            ) : '—'}
          </div>
          <div className="text-[10px] font-mono text-zinc-400">
            {hasGpus && kpis.totalVramTotalMb > 0
              ? `${Math.round((kpis.totalVramUsedMb / kpis.totalVramTotalMb) * 100)}% allocated`
              : 'Telemetry unavailable'}
          </div>
        </div>

        {/* KPI 5: Cluster Power */}
        <div className="bg-zinc-950/90 rounded-xl p-3.5 border border-zinc-800 space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>Cluster Power</span>
            <Thermometer className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {hasGpus ? `${(kpis.clusterPowerWatts / 1000).toFixed(2)} kW` : '—'}
          </div>
          <div className="text-[10px] font-mono text-zinc-400">
            {hasGpus ? `TDP limit: ${(kpis.clusterPowerLimitWatts / 1000).toFixed(2)} kW` : 'Telemetry unavailable'}
          </div>
        </div>

        {/* KPI 6: Active Alerts */}
        <div className="bg-zinc-950/90 rounded-xl p-3.5 border border-zinc-800 space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>Active Alerts</span>
            <BellRing className={`w-3.5 h-3.5 ${activeAlerts.length > 0 ? 'text-rose-400' : 'text-zinc-500'}`} />
          </div>
          <div className={`text-2xl font-bold font-mono ${activeAlerts.length > 0 ? 'text-rose-400' : 'text-white'}`}>
            {activeAlerts.length}
          </div>
          <div className="text-[10px] font-mono text-zinc-400">
            {activeAlerts.length > 0 ? 'Threshold breaches' : 'Nominal state'}
          </div>
        </div>
      </div>

      {/* Real Node Inventory Grid (Section 7 of requirements) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
              Connected Node Inventory ({nodes.length})
            </h3>
          </div>
          <button
            onClick={() => onNavigate('nodes')}
            className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Inventory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {nodes.map((node) => {
            const hasNodeGpus = node.gpus && node.gpus.length > 0;
            const avgGpuUtil = hasNodeGpus 
              ? Math.round(node.gpus.reduce((acc, g) => acc + g.utilizationGpu, 0) / node.gpus.length)
              : 0;
            const totalVramUsed = hasNodeGpus ? node.gpus.reduce((acc, g) => acc + g.vramUsedMb, 0) : 0;
            const totalVramTotal = hasNodeGpus ? node.gpus.reduce((acc, g) => acc + g.vramTotalMb, 0) : 0;
            const vramPct = totalVramTotal > 0 ? Math.round((totalVramUsed / totalVramTotal) * 100) : 0;
            const totalPower = hasNodeGpus ? node.gpus.reduce((acc, g) => acc + g.powerDrawWatts, 0) : 0;
            const maxTemp = hasNodeGpus ? Math.max(...node.gpus.map(g => g.temperatureC)) : node.cpu.temperatureC || 40;

            const isOnline = node.status === 'ONLINE' || node.status === 'BUSY';
            const isStale = node.status === 'STALE';
            const isOffline = node.status === 'OFFLINE';

            return (
              <div
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className="bg-zinc-950/90 hover:bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-lg space-y-3"
              >
                {/* Node Card Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white font-mono truncate" title={node.hostname}>
                      {node.hostname}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400">
                      IP: {node.ip} {node.isLocalHost ? '· Local Agent' : '· External Node'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isOnline && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ONLINE
                      </span>
                    )}
                    {isStale && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        STALE
                      </span>
                    )}
                    {isOffline && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-400 border border-rose-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        OFFLINE
                      </span>
                    )}
                  </div>
                </div>

                {/* Node Telemetry Matrix */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {/* GPU info */}
                  <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block uppercase">GPU Array</span>
                    <span className="font-bold text-zinc-200">
                      {hasNodeGpus ? `${node.gpus.length} GPUs (${avgGpuUtil}%)` : '0 Devices (CPU)'}
                    </span>
                  </div>

                  {/* VRAM info */}
                  <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block uppercase">VRAM Allocation</span>
                    <span className="font-bold text-zinc-200">
                      {hasNodeGpus ? `${vramPct}% (${(totalVramUsed / 1024).toFixed(0)}G)` : '—'}
                    </span>
                  </div>

                  {/* CPU load */}
                  <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block uppercase">Host CPU</span>
                    <span className="font-bold text-zinc-200">{node.cpu.utilization}%</span>
                  </div>

                  {/* RAM usage */}
                  <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block uppercase">Host RAM</span>
                    <span className="font-bold text-zinc-200">
                      {node.ram.usedGb} / {node.ram.totalGb} GB
                    </span>
                  </div>
                </div>

                {/* Footer specs */}
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/60">
                  <span>Temp: <strong className="text-zinc-200">{maxTemp}&deg;C</strong></span>
                  <span>Power: <strong className="text-zinc-200">{totalPower > 0 ? `${totalPower.toFixed(0)}W` : 'Host'}</strong></span>
                  <span>Heartbeat: <strong className="text-emerald-400">{node.lastHeartbeatTime}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Alerts Feed if any */}
      {activeAlerts.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-rose-400 animate-bounce" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
                Active Threshold Breaches ({activeAlerts.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-xs font-mono text-rose-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Alerts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-rose-900/40 text-xs font-mono">
            {activeAlerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="py-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white">
                    {alert.severity}
                  </span>
                  <span className="font-bold text-white">{alert.nodeHostname}:</span>
                  <span className="text-rose-200">{alert.description}</span>
                </div>
                <span className="text-[10px] text-zinc-400 shrink-0">{alert.timestamp.split('T')[1]?.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
