import React, { useState, useEffect } from 'react';
import { NodeProfile, GpuInfo, TimeSeriesPoint, TimeRange } from '../types';
import { HistoricalChart } from '../components/HistoricalChart';
import { fetchHistoricalTelemetry } from '../services/api';
import { 
  Zap, 
  ArrowLeft, 
  Activity, 
  Thermometer, 
  Gauge, 
  Wind, 
  ShieldCheck, 
  Terminal, 
  Clock, 
  Layers, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface GpuDetailPageProps {
  node: NodeProfile;
  gpu: GpuInfo;
  onBack: () => void;
}

export const GpuDetailPage: React.FC<GpuDetailPageProps> = ({
  node,
  gpu,
  onBack,
}) => {
  const [range, setRange] = useState<TimeRange>('1h');
  const [historyPoints, setHistoryPoints] = useState<TimeSeriesPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  // Fetch real historical points for this specific GPU and time range
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchHistoricalTelemetry({
        nodeId: node.id,
        gpuIndex: gpu.index,
        range,
      });
      setHistoryPoints(data.points || []);
    } catch (err) {
      setHistoryPoints([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // Poll history every 5s while on this page
    const timer = setInterval(loadHistory, 5000);
    return () => clearInterval(timer);
  }, [node.id, gpu.index, range]);

  const vramPct = gpu.vramTotalMb > 0 ? (gpu.vramUsedMb / gpu.vramTotalMb) * 100 : 0;
  const powerPct = gpu.powerLimitWatts > 0 ? (gpu.powerDrawWatts / gpu.powerLimitWatts) * 100 : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
        <button
          onClick={onBack}
          className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{node.hostname}</span>
        </button>
        <span>/</span>
        <span>GPUs</span>
        <span>/</span>
        <span className="text-emerald-400 font-bold">
          GPU #{gpu.index} ({gpu.name})
        </span>
      </div>

      {/* GPU Hero Identity Card */}
      <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-white font-mono tracking-tight">{gpu.name}</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold">
                  Device #{gpu.index}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
                  Bus: {gpu.busId || '0000:00:00.0'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">
                UUID: {gpu.uuid}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              Driver: <strong className="text-emerald-400">{gpu.driverVersion}</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              CUDA: <strong className="text-emerald-400">{gpu.cudaVersion}</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              PCIe: Gen{gpu.pcieGen} {gpu.pcieWidth}
            </span>
          </div>
        </div>

        {/* 6 Real Gauge Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
          {/* Utilization */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase block font-bold">Compute Load</span>
            <div className="text-xl font-bold text-white">{gpu.utilizationGpu}%</div>
            <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-emerald-400" style={{ width: `${Math.max(2, gpu.utilizationGpu)}%` }} />
            </div>
          </div>

          {/* VRAM Allocation */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase block font-bold">VRAM Usage</span>
            <div className="text-xl font-bold text-white truncate">
              {(gpu.vramUsedMb / 1024).toFixed(1)} <span className="text-xs text-zinc-400 font-normal">/ {(gpu.vramTotalMb / 1024).toFixed(0)}G</span>
            </div>
            <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-purple-500" style={{ width: `${Math.max(2, vramPct)}%` }} />
            </div>
          </div>

          {/* Temperature */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase block font-bold">Core Die Temp</span>
            <div className={`text-xl font-bold ${gpu.temperatureC > 80 ? 'text-rose-400' : 'text-white'}`}>
              {gpu.temperatureC}&deg;C
            </div>
            <div className="text-[10px] text-zinc-400">Ceiling: 85°C</div>
          </div>

          {/* Power Draw */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase block font-bold">Power Draw</span>
            <div className="text-xl font-bold text-white">
              {gpu.powerDrawWatts.toFixed(0)} <span className="text-xs text-zinc-400 font-normal">/ {gpu.powerLimitWatts}W</span>
            </div>
            <div className="text-[10px] text-zinc-400">{powerPct.toFixed(0)}% TDP limit</div>
          </div>

          {/* Clocks */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase block font-bold">Graphics Clock</span>
            <div className="text-xl font-bold text-white">
              {gpu.clockCoreMhz || 0} <span className="text-xs text-zinc-400 font-normal">MHz</span>
            </div>
            <div className="text-[10px] text-zinc-400">Mem: {gpu.clockMemoryMhz || 0} MHz</div>
          </div>

          {/* Fan & Throttle */}
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase block font-bold">Fan & Throttling</span>
            <div className="text-xl font-bold text-white">{gpu.fanSpeedPercent}% fan</div>
            <div className={`text-[10px] font-bold ${gpu.throttleReason !== 'None' ? 'text-amber-400' : 'text-emerald-400'}`}>
              {gpu.throttleReason || 'Nominal'}
            </div>
          </div>
        </div>
      </div>

      {/* Real Historical Telemetry Charts (Section 9 of prompt) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
              Live Stored Time-Series Telemetry ({historyPoints.length} Points Recorded)
            </h2>
          </div>
          <button
            onClick={loadHistory}
            className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chart 1: GPU Utilization */}
          <HistoricalChart
            title="GPU Core Compute Load"
            unit="%"
            dataKey="gpuUtil"
            points={historyPoints}
            color="#10b981"
            range={range}
            onRangeChange={setRange}
            maxValue={100}
            thresholdValue={90}
            thresholdLabel="Warn: 90%"
          />

          {/* Chart 2: VRAM Allocation */}
          <HistoricalChart
            title="VRAM Allocation"
            unit="%"
            dataKey="vramPercent"
            points={historyPoints}
            color="#a855f7"
            range={range}
            onRangeChange={setRange}
            maxValue={100}
            thresholdValue={90}
            thresholdLabel="OOM Danger: 90%"
          />

          {/* Chart 3: Temperature */}
          <HistoricalChart
            title="Silicon Die Temperature"
            unit="°C"
            dataKey="tempC"
            points={historyPoints}
            color="#f59e0b"
            range={range}
            onRangeChange={setRange}
            thresholdValue={85}
            thresholdLabel="Thermal Ceiling: 85°C"
          />

          {/* Chart 4: Power Draw */}
          <HistoricalChart
            title="Instantaneous Power Consumption"
            unit="W"
            dataKey="powerW"
            points={historyPoints}
            color="#38bdf8"
            range={range}
            onRangeChange={setRange}
            thresholdValue={gpu.powerLimitWatts}
            thresholdLabel={`TDP: ${gpu.powerLimitWatts}W`}
          />
        </div>
      </div>

      {/* GPU Processes Table */}
      <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
              Active Processes on Device #{gpu.index} ({gpu.processes?.length || 0})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Source: nvmlDeviceGetComputeRunningProcesses()
          </span>
        </div>

        {!gpu.processes || gpu.processes.length === 0 ? (
          <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800/80 text-center text-xs font-mono text-zinc-500">
            Device is IDLE &bull; No active CUDA compute contexts running on GPU #{gpu.index}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 pb-2">
                  <th className="pb-2 font-medium">PID</th>
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Process Name / Command</th>
                  <th className="pb-2 font-medium text-right">VRAM Footprint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {gpu.processes.map((proc) => (
                  <tr key={proc.pid} className="hover:bg-zinc-900/40">
                    <td className="py-2.5 font-bold text-emerald-400">#{proc.pid}</td>
                    <td className="py-2.5 text-zinc-300">{proc.user}</td>
                    <td className="py-2.5 text-zinc-200 truncate max-w-xs">{proc.processName}</td>
                    <td className="py-2.5 text-right font-bold text-purple-400">{proc.usedMemoryMb} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
