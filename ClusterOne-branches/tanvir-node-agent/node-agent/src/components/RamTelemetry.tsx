import React from 'react';
import { Layers, Database, ShieldAlert } from 'lucide-react';
import { RamInfo } from '../types';

interface RamTelemetryProps {
  ram: RamInfo;
}

export const RamTelemetry: React.FC<RamTelemetryProps> = ({ ram }) => {
  const usedPercent = (ram.usedGb / ram.totalGb) * 100;
  const cachedPercent = (ram.cachedGb / ram.totalGb) * 100;
  const freePercent = (ram.freeGb / ram.totalGb) * 100;
  const swapPercent = ram.swapTotalGb > 0 ? (ram.swapUsedGb / ram.swapTotalGb) * 100 : 0;

  return (
    <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 shadow-lg flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">System Memory (RAM)</h3>
              <p className="text-xs text-zinc-400 font-mono">DDR4 / DDR5 High-Bandwidth Interleaved</p>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-xs font-mono font-bold text-purple-400">
            {ram.totalGb.toFixed(0)} GB Total
          </div>
        </div>

        {/* Big Usage Stats */}
        <div className="my-4">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <span className="text-2xl font-bold font-mono text-white">{ram.usedGb.toFixed(1)}</span>
              <span className="text-xs text-zinc-400 font-mono ml-1.5">/ {ram.totalGb.toFixed(1)} GB in use</span>
            </div>
            <span className="text-sm font-bold font-mono text-purple-400">
              {usedPercent.toFixed(1)}%
            </span>
          </div>

          {/* Segmented RAM Visual Bar */}
          <div className="w-full h-4 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 flex">
            {/* Used */}
            <div 
              className="h-full bg-purple-500 transition-all duration-500 relative group"
              style={{ width: `${usedPercent}%` }}
              title={`Active Process RAM: ${ram.usedGb} GB`}
            />
            {/* Cached */}
            <div 
              className="h-full bg-purple-700/60 transition-all duration-500 relative group"
              style={{ width: `${cachedPercent}%` }}
              title={`Page Buffers & Cache: ${ram.cachedGb} GB`}
            />
            {/* Free */}
            <div 
              className="h-full bg-zinc-950 transition-all duration-500"
              style={{ width: `${freePercent}%` }}
              title={`Free Available: ${ram.freeGb} GB`}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] font-mono mt-2 text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
              Used: {ram.usedGb.toFixed(1)} GB
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-700/60" />
              Cached: {ram.cachedGb.toFixed(1)} GB
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-zinc-800" />
              Free: {ram.freeGb.toFixed(1)} GB
            </span>
          </div>
        </div>

        {/* Detailed Breakdown Cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Linux Swap File</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-bold font-mono text-zinc-200">
                {ram.swapUsedGb.toFixed(1)} / {ram.swapTotalGb.toFixed(0)} GB
              </span>
              <span className="text-xs font-mono text-zinc-400">{swapPercent.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-1.5">
              <div 
                className="h-full bg-amber-500" 
                style={{ width: `${Math.min(100, swapPercent)}%` }} 
              />
            </div>
          </div>

          <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Available For Slurm Jobs</span>
            <div className="text-sm font-bold font-mono text-emerald-400 mt-1">
              {(ram.freeGb + ram.cachedGb).toFixed(1)} GB
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">RealAllocatable</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
        <span>Collector: psutil.virtual_memory()</span>
        <span>Overcommit: Disabled (2)</span>
      </div>
    </div>
  );
};
