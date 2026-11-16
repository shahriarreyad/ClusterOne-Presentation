import React from 'react';
import { NodeProfile } from '../types';
import { Network, Server, Cpu, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

interface TopologyPageProps {
  nodes: NodeProfile[];
  onSelectNode: (nodeId: string) => void;
  onSelectGpu: (nodeId: string, gpuIndex: number) => void;
}

export const TopologyPage: React.FC<TopologyPageProps> = ({
  nodes,
  onSelectNode,
  onSelectGpu,
}) => {
  const nodesWithGpus = nodes.filter(n => n.gpus && n.gpus.length > 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950/90 p-4 rounded-2xl border border-zinc-800">
        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 font-mono">
          <Network className="w-5 h-5 text-purple-400" />
          PCIe & NVLink Accelerator Interconnect Topology
        </h2>
        <p className="text-xs font-mono text-zinc-400 mt-0.5">
          Real detected bus routing: maps NUMA affinities, PCIe root complexes, and peer-to-peer NVLink crossbars
        </p>
      </div>

      {nodesWithGpus.length === 0 ? (
        <div className="bg-zinc-950/90 rounded-2xl border border-dashed border-zinc-800 p-12 text-center space-y-3">
          <Network className="w-8 h-8 text-zinc-600 mx-auto" />
          <div className="text-sm font-bold text-zinc-300 font-mono">
            Topology information unavailable
          </div>
          <p className="text-xs text-zinc-500 font-mono max-w-md mx-auto">
            No physical GPU accelerator hardware detected on currently connected nodes. Topology tree will populate when nodes reporting NVML device paths are registered.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {nodesWithGpus.map((node) => {
            const hasNvlink = node.gpus.some(g => g.nvlinkStatus === 'ACTIVE');

            return (
              <div key={node.id} className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
                {/* Node Top Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white font-mono text-sm">{node.hostname}</span>
                    <span className="text-xs font-mono text-zinc-400">({node.ip})</span>
                  </div>

                  <div className="text-xs font-mono text-purple-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span>{hasNvlink ? 'NVLink Crossbar Active' : 'PCIe Root Complex Bus'}</span>
                  </div>
                </div>

                {/* Host CPU & NUMA Node representation */}
                <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-zinc-200">Host CPU Socket 0 / NUMA Node 0</span>
                    <span className="text-zinc-500">&bull; {node.cpu.cores} Cores</span>
                  </div>
                  <span className="text-zinc-400">Host PCIe Controller Gen4/Gen5</span>
                </div>

                {/* Detected GPU Devices on this Node */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  {node.gpus.map((gpu) => (
                    <div
                      key={gpu.index}
                      onClick={() => onSelectGpu(node.id, gpu.index)}
                      className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-3.5 rounded-xl cursor-pointer transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          GPU #{gpu.index}
                        </span>
                        <span className="text-[10px] text-zinc-400">{gpu.busId || '0000:00:00.0'}</span>
                      </div>

                      <div className="text-xs font-mono text-zinc-300 font-bold truncate">
                        {gpu.name}
                      </div>

                      <div className="text-[11px] font-mono text-zinc-400 space-y-0.5 pt-1 border-t border-zinc-800/80">
                        <div>PCIe: Gen{gpu.pcieGen} {gpu.pcieWidth}</div>
                        <div>NUMA Node: {gpu.numaNode ?? 0}</div>
                        <div className="text-purple-400">
                          Interconnect: {gpu.nvlinkStatus === 'ACTIVE' ? 'NVLink P2P' : 'PCIe Direct DMA'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
