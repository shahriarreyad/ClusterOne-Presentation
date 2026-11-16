import React, { useState } from 'react';
import { 
  Activity, 
  Wifi, 
  Clock, 
  Send, 
  Flame, 
  AlertCircle, 
  ShieldCheck, 
  Zap, 
  Server, 
  HardDrive, 
  Layers, 
  Cpu,
  Ban,
  CheckCircle2,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { NodeProfile, NodeStatus } from '../types';

interface NodeSummaryCardProps {
  node: NodeProfile;
  status: NodeStatus;
  agentRunning: boolean;
  heartbeatSeq: number;
  lastHeartbeatTime: string;
  nextHeartbeatSec: number;
  heartbeatLatencyMs: number;
  onForceHeartbeat: () => void;
  onTriggerJob: () => void;
  onToggleDrain: () => void;
  onRunSelfTest: () => void;
  onSimulateStress: () => void;
  onSimulateOOM: () => void;
  onSimulateNetworkToggle: () => void;
  networkConnected: boolean;
  activeJobCount: number;
}

export const NodeSummaryCard: React.FC<NodeSummaryCardProps> = ({
  node,
  status,
  agentRunning,
  heartbeatSeq,
  lastHeartbeatTime,
  nextHeartbeatSec,
  heartbeatLatencyMs,
  onForceHeartbeat,
  onTriggerJob,
  onToggleDrain,
  onRunSelfTest,
  onSimulateStress,
  onSimulateOOM,
  onSimulateNetworkToggle,
  networkConnected,
  activeJobCount,
}) => {
  const [showStagingTools, setShowStagingTools] = useState(false);
  const totalGpuCount = node.gpus ? node.gpus.length : 0;
  const primaryGpu = node.gpus && node.gpus.length > 0 ? node.gpus[0] : undefined;
  const totalGpuVramUsed = node.gpus ? node.gpus.reduce((acc, g) => acc + g.vramUsedMb, 0) : 0;
  const totalGpuVramTotal = node.gpus ? node.gpus.reduce((acc, g) => acc + g.vramTotalMb, 0) : 0;
  const avgGpuCompute = totalGpuCount > 0 ? Math.round(node.gpus.reduce((acc, g) => acc + g.utilizationGpu, 0) / totalGpuCount) : 0;
  const isDraining = status === 'DRAINING';

  return (
    <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 shadow-xl relative overflow-hidden">
      {/* Background subtle glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top row: Machine metadata & Heartbeat live state */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-white font-mono tracking-tight flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-400" />
              {node.hostname}
            </h2>
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-xs border border-zinc-700">
              IP: {node.ip}
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-800/60 text-zinc-400 text-xs">
              {node.os}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono break-all">
            Kernel: {node.kernel} &bull; Uptime: {node.uptimeHours.toFixed(1)}h &bull; Target Controller: <span className="text-emerald-400">http://controller.clusterone.local:8080</span>
          </p>
        </div>

        {/* Heartbeat Status Box */}
        <div className="flex items-center gap-3 bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/90 shrink-0">
          <div className="flex items-center gap-2 pr-3 border-r border-zinc-800">
            <div className="relative">
              <div className={`w-3 h-3 rounded-full ${
                !agentRunning || !networkConnected 
                  ? 'bg-zinc-600' 
                  : status === 'ERROR' 
                    ? 'bg-rose-500 animate-ping' 
                    : 'bg-emerald-400 animate-pulse'
              }`} />
              {agentRunning && networkConnected && (
                <span className="absolute -inset-1 rounded-full bg-emerald-400/30 animate-ping" />
              )}
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Heartbeat Service</div>
              <div className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-1">
                <Wifi className={`w-3 h-3 ${networkConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
                {agentRunning && networkConnected ? (
                  <>
                    Seq <span className="text-emerald-400 font-bold">#{heartbeatSeq}</span>
                    <span className="text-zinc-500">({heartbeatLatencyMs}ms)</span>
                  </>
                ) : (
                  <span className="text-zinc-500">Disconnected</span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Next Cycle</div>
            <div className="text-xs font-mono font-medium text-emerald-400 flex items-center justify-end gap-1">
              <Clock className="w-3 h-3 text-zinc-400" />
              {agentRunning && networkConnected ? `${nextHeartbeatSec.toFixed(1)}s` : '--'}
            </div>
          </div>

          <button
            id="btn-force-heartbeat"
            onClick={onForceHeartbeat}
            disabled={!agentRunning || !networkConnected}
            className="ml-1 p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 disabled:opacity-40 transition-colors"
            title="Send immediate Heartbeat Ping to Controller"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Specs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
        {/* CPU Spec */}
        <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              CPU Resource
            </span>
            <span className="text-[11px] font-mono text-zinc-500">{node.cpu.cores} Cores</span>
          </div>
          <div className="text-lg font-bold text-zinc-100 font-mono">
            {node.cpu.utilization.toFixed(1)}%
          </div>
          <div className="text-[11px] text-zinc-400 truncate mt-0.5" title={node.cpu.model}>
            {node.cpu.frequencyGhz} GHz &bull; {node.cpu.temperatureC}°C
          </div>
        </div>

        {/* RAM Spec */}
        <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              RAM Memory
            </span>
            <span className="text-[11px] font-mono text-zinc-500">{node.ram.totalGb} GB</span>
          </div>
          <div className="text-lg font-bold text-zinc-100 font-mono">
            {node.ram.usedGb.toFixed(1)} <span className="text-xs text-zinc-400 font-normal">GB used</span>
          </div>
          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
            {((node.ram.usedGb / node.ram.totalGb) * 100).toFixed(0)}% utilization
          </div>
        </div>

        {/* GPU Spec */}
        <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className={`w-3.5 h-3.5 ${totalGpuCount > 0 ? 'text-emerald-400' : 'text-zinc-500'}`} />
              {totalGpuCount > 1 ? 'GPU Cluster Array' : 'NVIDIA GPU'}
            </span>
            <span className={`text-[11px] font-mono ${totalGpuCount > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {totalGpuCount > 1 ? `${totalGpuCount} Accel Units` : (totalGpuCount === 1 ? 'NVML Active' : '0 Devices')}
            </span>
          </div>
          <div className="text-lg font-bold text-zinc-100 font-mono truncate" title={totalGpuCount > 1 ? `${totalGpuCount}x Accelerators` : (primaryGpu?.name || 'CPU Partition')}>
            {totalGpuCount > 0 ? `${avgGpuCompute}%` : '0%'}{' '}
            <span className="text-xs text-zinc-400 font-normal">{totalGpuCount > 1 ? 'avg load' : (totalGpuCount === 1 ? 'compute' : 'CPU-only')}</span>
          </div>
          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
            {totalGpuCount > 1 ? (
              <>{primaryGpu?.name.replace('NVIDIA ', '')} &bull; {(totalGpuVramUsed / 1024).toFixed(0)}/{(totalGpuVramTotal / 1024).toFixed(0)} GB Pool</>
            ) : totalGpuCount === 1 && primaryGpu ? (
              <>{primaryGpu.name} &bull; {(primaryGpu.vramUsedMb / 1024).toFixed(1)}/{(primaryGpu.vramTotalMb / 1024).toFixed(0)}GB</>
            ) : (
              'Running on host CPU compute'
            )}
          </div>
        </div>

        {/* Scratch Mount */}
        <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              Root / Scratch
            </span>
            <span className="text-[11px] font-mono text-amber-400">
              {node.disks.find(d => d.path === '/scratch') ? '/scratch' : (node.disks[0]?.path || '/')}
            </span>
          </div>
          <div className="text-lg font-bold text-zinc-100 font-mono">
            {(node.disks.find(d => d.path === '/scratch') || node.disks[0])?.usedGb.toFixed(0) || 0}{' '}
            <span className="text-xs text-zinc-400 font-normal">
              / {(node.disks.find(d => d.path === '/scratch') || node.disks[0])?.totalGb.toFixed(0) || 0} GB
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
            {(node.disks.find(d => d.path === '/scratch') || node.disks[0])?.purpose || 'Host Storage'}
          </div>
        </div>
      </div>

      {/* Industry-Grade Node Operations & Lifecycle Control Bar */}
      <div className="pt-3 border-t border-zinc-800/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-zinc-300">Node Lifecycle & Operations:</span>
            <span className="text-zinc-500 hidden md:inline">Manage node schedulability, diagnostics, and container execution</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Dispatch Workload */}
            <button
              id="btn-trigger-ai-job"
              onClick={onTriggerJob}
              disabled={!agentRunning || !networkConnected || isDraining}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all disabled:opacity-40 cursor-pointer"
              title="Submit containerized AI workload (Apptainer / Slurm job step)"
            >
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span>{activeJobCount > 0 ? '+ Schedule Subtask' : 'Dispatch Workload'}</span>
            </button>

            {/* 2. Run Self-Test Diagnostics */}
            <button
              id="btn-run-self-test"
              onClick={onRunSelfTest}
              disabled={!agentRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all disabled:opacity-40 cursor-pointer"
              title="Run NVML, PCIe, scratch I/O, and TLS latency diagnostic suite"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Run Self-Test</span>
            </button>

            {/* 3. Drain / Cordon Node */}
            <button
              id="btn-toggle-drain-node"
              onClick={onToggleDrain}
              disabled={!agentRunning}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                isDraining
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
              title={isDraining ? "Activate node for new job scheduling" : "Drain node: stop new scheduling for maintenance"}
            >
              <Ban className={`w-3.5 h-3.5 ${isDraining ? 'text-amber-400' : 'text-zinc-400'}`} />
              <span>{isDraining ? 'Undrain Node' : 'Drain (Maintenance)'}</span>
            </button>

            {/* 4. Force Heartbeat Sync */}
            <button
              id="btn-force-heartbeat-sync"
              onClick={onForceHeartbeat}
              disabled={!agentRunning || !networkConnected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all disabled:opacity-40 cursor-pointer"
              title="Trigger immediate telemetry transmission to controller"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Sync Heartbeat</span>
            </button>

            {/* 5. Staging / Fault Injection Drawer Toggle */}
            <button
              id="btn-toggle-staging-tools"
              onClick={() => setShowStagingTools(!showStagingTools)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                showStagingTools
                  ? 'bg-zinc-800 text-emerald-400 border-zinc-700'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-300 border-zinc-800'
              }`}
              title="Toggle resilience and chaos testing tools (Staging)"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="text-[11px]">Resilience Lab</span>
              {showStagingTools ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Collapsible Staging & Resilience Fault Injection Panel */}
        {showStagingTools && (
          <div className="bg-zinc-950/90 rounded-xl p-3 border border-zinc-800/90 flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-semibold">
                STAGING ONLY
              </span>
              <span className="text-zinc-400 text-xs font-mono">Chaos & Fault Injection Suite:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-stress-gpu"
                onClick={onSimulateStress}
                disabled={!agentRunning || !networkConnected}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all disabled:opacity-40 cursor-pointer"
                title="Simulate 95% GPU compute & high memory load"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Stress GPU Load</span>
              </button>

              <button
                id="btn-simulate-oom"
                onClick={onSimulateOOM}
                disabled={!agentRunning || !networkConnected}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all disabled:opacity-40 cursor-pointer"
                title="Simulate GPU CUDA Out of Memory driver event"
              >
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span>Inject CUDA OOM</span>
              </button>

              <button
                id="btn-toggle-network"
                onClick={onSimulateNetworkToggle}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  networkConnected 
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700' 
                    : 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                }`}
                title="Simulate network switch cable disconnect or reconnect"
              >
                <Wifi className="w-3 h-3" />
                <span>{networkConnected ? 'Simulate Link Drop' : 'Restore Link'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
