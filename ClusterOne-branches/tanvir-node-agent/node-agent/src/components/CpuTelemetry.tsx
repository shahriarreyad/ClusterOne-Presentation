import React from 'react';
import { Cpu, Thermometer, Gauge, Activity, Radio } from 'lucide-react';
import { CpuInfo } from '../types';

interface CpuTelemetryProps {
  cpu: CpuInfo;
}

export const CpuTelemetry: React.FC<CpuTelemetryProps> = ({ cpu }) => {
  return (
    <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 shadow-lg flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">CPU Telemetry Engine</h3>
              <p className="text-xs text-zinc-400 font-mono truncate max-w-[280px]" title={cpu.model}>
                {cpu.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-xs font-mono text-blue-400">
            <Radio className="w-3 h-3 animate-pulse text-blue-400" />
            {cpu.frequencyGhz} GHz
          </div>
        </div>

        {/* Big Utilization Gauge & Key Metrics */}
        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Load (1m/5m/15m)</span>
            <div className="text-xs font-bold text-zinc-200 font-mono mt-1">
              {cpu.loadAvg[0]} &bull; {cpu.loadAvg[1]} &bull; {cpu.loadAvg[2]}
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Linux LoadAvg</span>
          </div>

          <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-400" /> Package Temp
            </span>
            <div className="text-xs font-bold text-amber-400 font-mono mt-1">
              {cpu.temperatureC}°C
            </div>
            <span className="text-[10px] text-zinc-500">Tctl / Tdie</span>
          </div>

          <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Governor</span>
            <div className="text-xs font-bold text-emerald-400 font-mono mt-1 capitalize">
              {cpu.governor}
            </div>
            <span className="text-[10px] text-zinc-500">{cpu.cores}C / {cpu.threads}T</span>
          </div>
        </div>

        {/* Overall Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="text-zinc-400 font-medium">Aggregated CPU Utilization</span>
            <span className="font-mono font-bold text-white">{cpu.utilization.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                cpu.utilization > 85 ? 'bg-rose-500' : cpu.utilization > 60 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(2, cpu.utilization))}%` }}
            />
          </div>
        </div>

        {/* Per-Core Visual Matrix */}
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2 font-mono">
            <span>Per-Core Breakdown ({cpu.perCoreUsage.length} Cores)</span>
            <span className="text-[10px] text-zinc-500">Probe interval: 100ms</span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80">
            {cpu.perCoreUsage.map((usage, idx) => (
              <div key={idx} className="flex flex-col items-center bg-zinc-900/90 rounded p-1 border border-zinc-800/60">
                <span className="text-[9px] font-mono text-zinc-500">C{idx}</span>
                <div className="w-full h-10 bg-zinc-950 rounded relative flex items-end overflow-hidden my-0.5">
                  <div 
                    className={`w-full transition-all duration-300 ${
                      usage > 85 ? 'bg-rose-500' : usage > 60 ? 'bg-amber-400' : 'bg-blue-400'
                    }`}
                    style={{ height: `${Math.max(4, usage)}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-zinc-300 font-semibold">{Math.round(usage)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
        <span>Collector: psutil.cpu_percent()</span>
        <span>Topology: NUMA node0</span>
      </div>
    </div>
  );
};
