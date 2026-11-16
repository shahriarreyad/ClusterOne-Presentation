import React from 'react';
import { NodeProfile } from '../types';
import { 
  Server, 
  Cpu, 
  HardDrive, 
  Network, 
  Layers, 
  Zap, 
  ArrowLeft, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Activity,
  Gauge
} from 'lucide-react';

interface NodeDetailPageProps {
  node: NodeProfile;
  onBack: () => void;
  onSelectGpu: (gpuIndex: number) => void;
}

export const NodeDetailPage: React.FC<NodeDetailPageProps> = ({
  node,
  onBack,
  onSelectGpu,
}) => {
  const hasGpus = node.gpus && node.gpus.length > 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Breadcrumbs Navigation */}
      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
        <button
          onClick={onBack}
          className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Cluster Overview</span>
        </button>
        <span>/</span>
        <span>Nodes</span>
        <span>/</span>
        <span className="text-emerald-400 font-bold">{node.hostname}</span>
      </div>

      {/* Node Identity Hero Card */}
      <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight font-mono">{node.hostname}</h1>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  node.status === 'ONLINE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' :
                  node.status === 'STALE' ? 'bg-amber-950 text-amber-400 border border-amber-500/30' :
                  'bg-rose-950 text-rose-400 border border-rose-500/30'
                }`}>
                  {node.status}
                </span>
                {node.isLocalHost && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
                    Host Node
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Node ID: <code className="text-zinc-300">{node.id}</code> &bull; IP: <code className="text-zinc-300">{node.ip}</code>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400">
              Uptime: <span className="text-zinc-200 font-bold">{node.uptimeHours} hrs</span>
            </div>
            <div className="bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400">
              Heartbeat: <span className="text-emerald-400 font-bold">{node.lastHeartbeatTime}</span>
            </div>
            <div className="bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400">
              Agent: <span className="text-zinc-300 font-bold">v{node.agentVersion || '2.4.0'}</span>
            </div>
          </div>
        </div>

        {/* Operating System Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono text-zinc-400">
          <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80">
            <span className="text-zinc-500 block text-[10px] uppercase">Operating System</span>
            <span className="font-bold text-zinc-200">{node.os}</span>
          </div>
          <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80">
            <span className="text-zinc-500 block text-[10px] uppercase">Kernel & Architecture</span>
            <span className="font-bold text-zinc-200">{node.kernel} ({node.architecture || 'x86_64'})</span>
          </div>
          <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80">
            <span className="text-zinc-500 block text-[10px] uppercase">Accelerators Attached</span>
            <span className="font-bold text-emerald-400">{node.gpus?.length || 0} Physical NVML Devices</span>
          </div>
        </div>
      </div>

      {/* Host Core Hardware Metrics (CPU, RAM, Disks, Network) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        {/* CPU Box */}
        <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-bold uppercase text-[10px] text-zinc-500">Host CPU</span>
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{node.cpu.utilization}%</div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.max(2, node.cpu.utilization)}%` }} />
          </div>
          <div className="text-[11px] text-zinc-400 space-y-0.5 pt-1">
            <div className="truncate" title={node.cpu.model}>{node.cpu.model}</div>
            <div>{node.cpu.cores} Cores &bull; Load: {node.cpu.loadAvg?.join(', ')}</div>
          </div>
        </div>

        {/* RAM Box */}
        <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-bold uppercase text-[10px] text-zinc-500">Host Memory</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {node.ram.usedGb} <span className="text-xs text-zinc-400 font-normal">/ {node.ram.totalGb} GB</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 rounded-full" 
              style={{ width: `${Math.max(2, node.ram.totalGb > 0 ? (node.ram.usedGb / node.ram.totalGb) * 100 : 0)}%` }} 
            />
          </div>
          <div className="text-[11px] text-zinc-400 space-y-0.5 pt-1">
            <div>Free: {node.ram.freeGb} GB &bull; Cached: {node.ram.cachedGb} GB</div>
            <div>Swap: {node.ram.swapUsedGb} / {node.ram.swapTotalGb} GB</div>
          </div>
        </div>

        {/* Disk Box */}
        <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-bold uppercase text-[10px] text-zinc-500">Storage Mounts</span>
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {node.disks?.[0]?.usedGb || 0} <span className="text-xs text-zinc-400 font-normal">/ {node.disks?.[0]?.totalGb || 0} GB</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-500 rounded-full" 
              style={{ width: `${Math.max(2, node.disks?.[0]?.utilizationPercent || 15)}%` }} 
            />
          </div>
          <div className="text-[11px] text-zinc-400 space-y-0.5 pt-1">
            <div>Mount: {node.disks?.[0]?.path || '/'} ({node.disks?.[0]?.fstype || 'ext4'})</div>
            <div>Free Space: {node.disks?.[0]?.freeGb || 0} GB</div>
          </div>
        </div>

        {/* Network Box */}
        <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-bold uppercase text-[10px] text-zinc-500">Network Interface</span>
            <Network className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {node.network?.rxKbps ? `${node.network.rxKbps.toFixed(0)} kbps` : '0 kbps'}
          </div>
          <div className="text-[11px] text-zinc-400 space-y-0.5 pt-1">
            <div>Interface: <strong className="text-zinc-200">{node.network?.interface || 'eth0'}</strong></div>
            <div>Speed: {node.network?.speedGbps || 10} Gbps &bull; Latency: {node.network?.latencyToControllerMs || 1}ms</div>
            <div>TX Rate: {node.network?.txKbps || 0} kbps</div>
          </div>
        </div>
      </div>

      {/* GPU Inventory on this Node (Section 8 of prompt) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
              GPU Inventory ({node.gpus?.length || 0} Accelerators)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Click any GPU card to view historical time-series telemetry
          </span>
        </div>

        {!hasGpus ? (
          <div className="bg-zinc-950/90 rounded-2xl border border-dashed border-zinc-800 p-8 text-center space-y-2">
            <Zap className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-sm font-bold text-zinc-300 font-mono">No physical GPUs detected on this node.</div>
            <p className="text-xs text-zinc-500 font-mono max-w-md mx-auto">
              Running in CPU host partition. If NVIDIA hardware is installed, verify the NVIDIA driver with <code>nvidia-smi</code> and ensure pynvml is available.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {node.gpus.map((gpu) => {
              const vramPct = gpu.vramTotalMb > 0 ? (gpu.vramUsedMb / gpu.vramTotalMb) * 100 : 0;
              const powerPct = gpu.powerLimitWatts > 0 ? (gpu.powerDrawWatts / gpu.powerLimitWatts) * 100 : 0;

              return (
                <div
                  key={gpu.index}
                  onClick={() => onSelectGpu(gpu.index)}
                  className="bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-lg space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white font-mono">{gpu.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold">
                          GPU #{gpu.index}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                        UUID: {gpu.uuid}
                      </p>
                    </div>

                    <div className="text-right font-mono text-xs">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        Inspect <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* GPU Key Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 block">Compute Load</span>
                      <span className="text-base font-bold text-white">{gpu.utilizationGpu}%</span>
                    </div>

                    <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 block">VRAM Used</span>
                      <span className="text-base font-bold text-white">
                        {(gpu.vramUsedMb / 1024).toFixed(1)} <span className="text-xs font-normal text-zinc-400">/ {(gpu.vramTotalMb / 1024).toFixed(0)}G</span>
                      </span>
                    </div>

                    <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 block">Die Temp</span>
                      <span className={`text-base font-bold ${gpu.temperatureC > 80 ? 'text-rose-400' : 'text-white'}`}>
                        {gpu.temperatureC}&deg;C
                      </span>
                    </div>

                    <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 block">Power</span>
                      <span className="text-base font-bold text-white">
                        {gpu.powerDrawWatts.toFixed(0)} <span className="text-xs font-normal text-zinc-400">/ {gpu.powerLimitWatts}W</span>
                      </span>
                    </div>
                  </div>

                  {/* Progress Bars */}
                  <div className="space-y-2 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-zinc-400">VRAM Allocation</span>
                        <span className="text-zinc-200">{vramPct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${Math.max(2, vramPct)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-zinc-400">Compute Load</span>
                        <span className="text-zinc-200">{gpu.utilizationGpu}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-400 rounded-full transition-all"
                          style={{ width: `${Math.max(2, gpu.utilizationGpu)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hardware Footer */}
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span>PCIe: Gen{gpu.pcieGen} {gpu.pcieWidth}</span>
                    <span>Driver: {gpu.driverVersion} &bull; CUDA {gpu.cudaVersion}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
