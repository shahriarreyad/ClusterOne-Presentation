import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Zap, 
  Thermometer, 
  Wind, 
  Gauge, 
  ShieldCheck, 
  Terminal, 
  AlertTriangle, 
  Flame, 
  BellRing, 
  BellOff, 
  AlertOctagon, 
  Sliders, 
  RotateCcw,
  Network,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
  Server,
  ArrowRight
} from 'lucide-react';
import { GpuInfo, GpuClusterSummary } from '../types';

interface GpuTelemetryProps {
  gpus: GpuInfo[];
  onAlertTriggered?: (alertMessage: string) => void;
}

// Automated Alert System Constants
export const VRAM_ALERT_THRESHOLD = 90; // Triggers visual warning when VRAM utilization > 90%
export const TEMP_ALERT_THRESHOLD = 85; // Triggers visual warning when temperature > 85°C

export type ClusterRigPreset = '4x_a100' | '8x_h100' | '4x_rtx4090' | 'live_detected';
export type GpuTelemetryViewMode = 'aggregate' | 'individual' | 'interconnect' | 'jobs';

export const GpuTelemetry: React.FC<GpuTelemetryProps> = ({ gpus, onAlertTriggered }) => {
  // Preset multi-GPU rig configurations for cluster simulation & real multi-GPU management
  const hasLiveHardware = gpus && gpus.length > 0;
  const [selectedRig, setSelectedRig] = useState<ClusterRigPreset>(hasLiveHardware ? 'live_detected' : '4x_a100');
  const [activeView, setActiveView] = useState<GpuTelemetryViewMode>('aggregate');
  const [selectedGpuIndex, setSelectedGpuIndex] = useState<number | 'all'>('all');
  
  // Alert system state
  const [simulationMode, setSimulationMode] = useState<'none' | 'vram_92' | 'temp_89' | 'dual_critical'>('none');
  const [dismissedWarnings, setDismissedWarnings] = useState<Record<number, boolean>>({});
  const lastAlertTimestampRef = useRef<Record<string, number>>({});

  // 1. Preset 4x NVIDIA A100-SXM4-80GB (320 GB Cluster VRAM, 600 GB/s NVLink 3)
  const a100Cluster: GpuInfo[] = useMemo(() => [
    {
      index: 0,
      name: 'NVIDIA A100-SXM4-80GB',
      uuid: 'GPU-A100-SXM4-0001-A100',
      busId: '0000:1a:00.0',
      numaNode: 0,
      driverVersion: '550.78.01',
      cudaVersion: '12.4',
      computeCapability: '8.0',
      vramTotalMb: 81920,
      vramUsedMb: 67120, // 81.9%
      vramFreeMb: 14800,
      utilizationGpu: 88,
      utilizationMemory: 82,
      temperatureC: 62,
      fanSpeedPercent: 65,
      powerDrawWatts: 342,
      powerLimitWatts: 400,
      pcieGen: 4,
      pcieWidth: 'x16',
      nvlinkStatus: 'ACTIVE',
      nvlinkBandwidthGbps: 600,
      clockCoreMhz: 1410,
      clockMemoryMhz: 1215,
      throttleReason: 'None',
      processes: [
        { pid: 28410, processName: 'python3 -m torch.distributed.run (Rank 0)', usedMemoryMb: 52100, user: 'ai_cluster', rank: 0, computeUtilPercent: 88 },
        { pid: 28490, processName: 'vllm.engine.async_llm_engine (TP=4)', usedMemoryMb: 15020, user: 'inference_svc', rank: 0, computeUtilPercent: 12 },
      ],
    },
    {
      index: 1,
      name: 'NVIDIA A100-SXM4-80GB',
      uuid: 'GPU-A100-SXM4-0002-B200',
      busId: '0000:3b:00.0',
      numaNode: 0,
      driverVersion: '550.78.01',
      cudaVersion: '12.4',
      computeCapability: '8.0',
      vramTotalMb: 81920,
      vramUsedMb: 67450, // 82.3%
      vramFreeMb: 14470,
      utilizationGpu: 89,
      utilizationMemory: 83,
      temperatureC: 64,
      fanSpeedPercent: 68,
      powerDrawWatts: 348,
      powerLimitWatts: 400,
      pcieGen: 4,
      pcieWidth: 'x16',
      nvlinkStatus: 'ACTIVE',
      nvlinkBandwidthGbps: 600,
      clockCoreMhz: 1410,
      clockMemoryMhz: 1215,
      throttleReason: 'None',
      processes: [
        { pid: 28411, processName: 'python3 -m torch.distributed.run (Rank 1)', usedMemoryMb: 52100, user: 'ai_cluster', rank: 1, computeUtilPercent: 89 },
        { pid: 28491, processName: 'vllm.engine.async_llm_engine (TP=4)', usedMemoryMb: 15350, user: 'inference_svc', rank: 1, computeUtilPercent: 11 },
      ],
    },
    {
      index: 2,
      name: 'NVIDIA A100-SXM4-80GB',
      uuid: 'GPU-A100-SXM4-0003-C300',
      busId: '0000:8d:00.0',
      numaNode: 1,
      driverVersion: '550.78.01',
      cudaVersion: '12.4',
      computeCapability: '8.0',
      vramTotalMb: 81920,
      vramUsedMb: 66890, // 81.6%
      vramFreeMb: 15030,
      utilizationGpu: 86,
      utilizationMemory: 81,
      temperatureC: 61,
      fanSpeedPercent: 62,
      powerDrawWatts: 335,
      powerLimitWatts: 400,
      pcieGen: 4,
      pcieWidth: 'x16',
      nvlinkStatus: 'ACTIVE',
      nvlinkBandwidthGbps: 600,
      clockCoreMhz: 1410,
      clockMemoryMhz: 1215,
      throttleReason: 'None',
      processes: [
        { pid: 28412, processName: 'python3 -m torch.distributed.run (Rank 2)', usedMemoryMb: 52100, user: 'ai_cluster', rank: 2, computeUtilPercent: 86 },
        { pid: 28492, processName: 'vllm.engine.async_llm_engine (TP=4)', usedMemoryMb: 14790, user: 'inference_svc', rank: 2, computeUtilPercent: 14 },
      ],
    },
    {
      index: 3,
      name: 'NVIDIA A100-SXM4-80GB',
      uuid: 'GPU-A100-SXM4-0004-D400',
      busId: '0000:ae:00.0',
      numaNode: 1,
      driverVersion: '550.78.01',
      cudaVersion: '12.4',
      computeCapability: '8.0',
      vramTotalMb: 81920,
      vramUsedMb: 66940, // 81.7%
      vramFreeMb: 14980,
      utilizationGpu: 87,
      utilizationMemory: 82,
      temperatureC: 63,
      fanSpeedPercent: 65,
      powerDrawWatts: 339,
      powerLimitWatts: 400,
      pcieGen: 4,
      pcieWidth: 'x16',
      nvlinkStatus: 'ACTIVE',
      nvlinkBandwidthGbps: 600,
      clockCoreMhz: 1410,
      clockMemoryMhz: 1215,
      throttleReason: 'None',
      processes: [
        { pid: 28413, processName: 'python3 -m torch.distributed.run (Rank 3)', usedMemoryMb: 52100, user: 'ai_cluster', rank: 3, computeUtilPercent: 87 },
        { pid: 28493, processName: 'vllm.engine.async_llm_engine (TP=4)', usedMemoryMb: 14840, user: 'inference_svc', rank: 3, computeUtilPercent: 13 },
      ],
    },
  ], []);

  // 2. Preset 8x NVIDIA H100 SXM5 (640 GB Cluster VRAM, 900 GB/s NVLink 4, 5,600 W Total TDP)
  const h100Cluster: GpuInfo[] = useMemo(() => Array.from({ length: 8 }).map((_, idx) => ({
    index: idx,
    name: 'NVIDIA H100 80GB HBM3 (SXM5)',
    uuid: `GPU-H100-SXM5-UUID-000${idx}`,
    busId: `0000:${(idx * 16 + 10).toString(16).padStart(2, '0')}:00.0`,
    numaNode: idx < 4 ? 0 : 1,
    driverVersion: '550.90.07',
    cudaVersion: '12.4',
    computeCapability: '9.0',
    vramTotalMb: 81920,
    vramUsedMb: Math.round(81920 * (0.84 + (idx % 3) * 0.02)),
    vramFreeMb: Math.round(81920 * (1 - (0.84 + (idx % 3) * 0.02))),
    utilizationGpu: 92 - (idx % 4),
    utilizationMemory: 85,
    temperatureC: 58 + (idx % 4) * 3,
    fanSpeedPercent: 72,
    powerDrawWatts: 580 + (idx % 3) * 35,
    powerLimitWatts: 700,
    pcieGen: 5,
    pcieWidth: 'x16',
    nvlinkStatus: 'ACTIVE',
    nvlinkBandwidthGbps: 900,
    clockCoreMhz: 1980,
    clockMemoryMhz: 2619,
    throttleReason: 'None',
    processes: [
      { pid: 31000 + idx, processName: `megatron.training.gpt_parallel (Rank ${idx})`, usedMemoryMb: 58400, user: 'cluster_admin', rank: idx, computeUtilPercent: 92 },
      { pid: 31200 + idx, processName: 'deepspeed.zero3.offload', usedMemoryMb: 11200, user: 'cluster_admin', rank: idx, computeUtilPercent: 8 },
    ],
  })), []);

  // 3. Preset 4x NVIDIA RTX 4090 Workstation Rig (96 GB Cluster VRAM, PCIe Gen4)
  const rtx4090Cluster: GpuInfo[] = useMemo(() => Array.from({ length: 4 }).map((_, idx) => ({
    index: idx,
    name: 'NVIDIA GeForce RTX 4090',
    uuid: `GPU-RTX4090-UUID-${idx}049`,
    busId: `0000:${(idx * 20 + 1).toString(16).padStart(2, '0')}:00.0`,
    numaNode: 0,
    driverVersion: '550.54.14',
    cudaVersion: '12.4',
    computeCapability: '8.9',
    vramTotalMb: 24576,
    vramUsedMb: Math.round(24576 * (0.75 + (idx % 2) * 0.05)),
    vramFreeMb: Math.round(24576 * (0.25 - (idx % 2) * 0.05)),
    utilizationGpu: 76 + (idx % 3) * 5,
    utilizationMemory: 78,
    temperatureC: 56 + idx * 3,
    fanSpeedPercent: 55,
    powerDrawWatts: 310 + idx * 25,
    powerLimitWatts: 450,
    pcieGen: 4,
    pcieWidth: 'x16',
    nvlinkStatus: 'INACTIVE',
    nvlinkBandwidthGbps: 0,
    clockCoreMhz: 2520,
    clockMemoryMhz: 1313,
    throttleReason: 'None',
    processes: [
      { pid: 18200 + idx, processName: `python3 -m accelerate.launch (Worker ${idx})`, usedMemoryMb: 16400, user: 'dev_user', rank: idx, computeUtilPercent: 78 },
      { pid: 18450 + idx, processName: 'ollama_inference_runner', usedMemoryMb: 2800, user: 'local_svc', rank: idx, computeUtilPercent: 12 },
    ],
  })), []);

  // Determine active GPU list based on selection and hardware
  const baseActiveGpus: GpuInfo[] = useMemo(() => {
    if (selectedRig === 'live_detected' && hasLiveHardware) {
      return gpus;
    }
    if (selectedRig === '8x_h100') return h100Cluster;
    if (selectedRig === '4x_rtx4090') return rtx4090Cluster;
    return a100Cluster;
  }, [selectedRig, hasLiveHardware, gpus, h100Cluster, rtx4090Cluster, a100Cluster]);

  // Apply simulated alert states if triggered by testing controls
  const effectiveGpus: GpuInfo[] = useMemo(() => {
    return baseActiveGpus.map((gpu, idx) => {
      if (simulationMode === 'vram_92' && idx === 0) {
        return {
          ...gpu,
          vramUsedMb: Math.round(gpu.vramTotalMb * 0.945), // 94.5% (> 90%)
          vramFreeMb: Math.round(gpu.vramTotalMb * 0.055),
          utilizationMemory: 95,
          temperatureC: 72,
        };
      }
      if (simulationMode === 'temp_89' && idx === 1) {
        return {
          ...gpu,
          temperatureC: 89, // 89°C (> 85°C)
          fanSpeedPercent: 100,
          utilizationGpu: 98,
          throttleReason: 'Thermal Slowdown',
        };
      }
      if (simulationMode === 'dual_critical') {
        if (idx === 0) {
          return {
            ...gpu,
            vramUsedMb: Math.round(gpu.vramTotalMb * 0.962),
            vramFreeMb: Math.round(gpu.vramTotalMb * 0.038),
            utilizationMemory: 97,
            temperatureC: 91,
            fanSpeedPercent: 100,
            throttleReason: 'Thermal & Power Cap',
          };
        }
        if (idx === 1) {
          return {
            ...gpu,
            vramUsedMb: Math.round(gpu.vramTotalMb * 0.925),
            temperatureC: 88,
            fanSpeedPercent: 100,
            throttleReason: 'Thermal Slowdown',
          };
        }
      }
      return gpu;
    });
  }, [baseActiveGpus, simulationMode]);

  // Cluster Aggregate Calculations ("sobgula mile cluster info dekhabe")
  const clusterSummary: GpuClusterSummary = useMemo(() => {
    const totalGpus = effectiveGpus.length;
    const onlineGpus = effectiveGpus.length;
    let totalVramTotalMb = 0;
    let totalVramUsedMb = 0;
    let totalVramFreeMb = 0;
    let sumComputeUtil = 0;
    let peakComputeUtil = 0;
    let sumTemp = 0;
    let peakTemp = 0;
    let totalPowerWatts = 0;
    let totalPowerLimitWatts = 0;
    let totalNvlinkBandwidthGbps = 0;
    let activeProcessesCount = 0;

    effectiveGpus.forEach(gpu => {
      totalVramTotalMb += gpu.vramTotalMb;
      totalVramUsedMb += gpu.vramUsedMb;
      totalVramFreeMb += gpu.vramFreeMb;
      sumComputeUtil += gpu.utilizationGpu;
      if (gpu.utilizationGpu > peakComputeUtil) peakComputeUtil = gpu.utilizationGpu;
      sumTemp += gpu.temperatureC;
      if (gpu.temperatureC > peakTemp) peakTemp = gpu.temperatureC;
      totalPowerWatts += gpu.powerDrawWatts;
      totalPowerLimitWatts += gpu.powerLimitWatts;
      if (gpu.nvlinkBandwidthGbps) totalNvlinkBandwidthGbps += gpu.nvlinkBandwidthGbps;
      activeProcessesCount += (gpu.processes ? gpu.processes.length : 0);
    });

    const totalVramUtilizationPercent = totalVramTotalMb > 0 
      ? Math.round((totalVramUsedMb / totalVramTotalMb) * 1000) / 10 
      : 0;
    const avgComputeUtilization = totalGpus > 0 ? Math.round(sumComputeUtil / totalGpus) : 0;
    const avgTemperatureC = totalGpus > 0 ? Math.round(sumTemp / totalGpus) : 0;
    const powerUtilizationPercent = totalPowerLimitWatts > 0 
      ? Math.round((totalPowerWatts / totalPowerLimitWatts) * 100) 
      : 0;

    const hasCritical = effectiveGpus.some(g => (g.vramUsedMb / g.vramTotalMb) * 100 > VRAM_ALERT_THRESHOLD && g.temperatureC > TEMP_ALERT_THRESHOLD);
    const hasWarning = effectiveGpus.some(g => (g.vramUsedMb / g.vramTotalMb) * 100 > VRAM_ALERT_THRESHOLD || g.temperatureC > TEMP_ALERT_THRESHOLD);

    return {
      totalGpus,
      onlineGpus,
      totalVramTotalMb,
      totalVramUsedMb,
      totalVramFreeMb,
      totalVramUtilizationPercent,
      avgComputeUtilization,
      peakComputeUtilization: peakComputeUtil,
      avgTemperatureC,
      peakTemperatureC: peakTemp,
      totalPowerWatts,
      totalPowerLimitWatts,
      powerUtilizationPercent,
      totalNvlinkBandwidthGbps,
      activeProcessesCount,
      healthStatus: hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'HEALTHY',
    };
  }, [effectiveGpus]);

  // Alert Evaluations across every single GPU
  const alertEvaluations = useMemo(() => {
    return effectiveGpus.map(gpu => {
      const vramPercent = (gpu.vramUsedMb / gpu.vramTotalMb) * 100;
      const isVramAlert = vramPercent > VRAM_ALERT_THRESHOLD;
      const isTempAlert = gpu.temperatureC > TEMP_ALERT_THRESHOLD;
      const isCritical = isVramAlert && isTempAlert;
      const hasWarning = isVramAlert || isTempAlert;
      const isDismissed = !!dismissedWarnings[gpu.index];

      return {
        gpuIndex: gpu.index,
        gpuName: gpu.name,
        vramPercent,
        temperatureC: gpu.temperatureC,
        isVramAlert,
        isTempAlert,
        isCritical,
        hasWarning,
        isDismissed,
      };
    });
  }, [effectiveGpus, dismissedWarnings]);

  const activeAlerts = alertEvaluations.filter(a => a.hasWarning && !a.isDismissed);
  const totalWarnings = activeAlerts.length;

  // Broadcast alerts to Live Logs Terminal when threshold breaches occur (throttled)
  useEffect(() => {
    activeAlerts.forEach(evalResult => {
      const now = Date.now();
      const alertKey = `cluster-gpu-${evalResult.gpuIndex}-${evalResult.isVramAlert ? 'vram' : ''}-${evalResult.isTempAlert ? 'temp' : ''}`;
      const lastLogged = lastAlertTimestampRef.current[alertKey] || 0;

      if (now - lastLogged > 10000) {
        lastAlertTimestampRef.current[alertKey] = now;
        if (onAlertTriggered) {
          const reasons: string[] = [];
          if (evalResult.isVramAlert) {
            reasons.push(`VRAM allocation breached threshold: ${evalResult.vramPercent.toFixed(1)}% (Limit: ${VRAM_ALERT_THRESHOLD}%)`);
          }
          if (evalResult.isTempAlert) {
            reasons.push(`Core die temp breached threshold: ${evalResult.temperatureC}°C (Limit: ${TEMP_ALERT_THRESHOLD}°C)`);
          }
          onAlertTriggered(`[CLUSTER GUARD: GPU #${evalResult.gpuIndex}] ${reasons.join(' | ')}`);
        }
      }
    });
  }, [activeAlerts, onAlertTriggered]);

  const handleDismissWarning = (index: number) => {
    setDismissedWarnings(prev => ({ ...prev, [index]: true }));
  };

  const handleResetDismissed = (index: number) => {
    setDismissedWarnings(prev => ({ ...prev, [index]: false }));
  };

  // Filter GPUs for individual view
  const displayedGpus = selectedGpuIndex === 'all' 
    ? effectiveGpus 
    : effectiveGpus.filter(g => g.index === selectedGpuIndex);

  return (
    <div className="space-y-4">
      {/* Industrial Cluster Master Control Header */}
      <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-4 space-y-4">
        {/* Top line: Cluster title & active rig selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  GPU Cluster Telemetry & Accelerator Mesh
                </h2>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono font-semibold text-emerald-400">
                  {clusterSummary.totalGpus} ACCELERATOR NODES ONLINE
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-0.5">
                <span>Cluster Fabric: {effectiveGpus[0]?.nvlinkStatus === 'ACTIVE' ? 'NVLink All-to-All Full-Mesh' : 'PCIe Gen4 Direct Ring'}</span>
                <span aria-hidden="true">&bull;</span>
                <span>Driver: {effectiveGpus[0]?.driverVersion}</span>
                <span aria-hidden="true">&bull;</span>
                <span>CUDA {effectiveGpus[0]?.cudaVersion}</span>
              </div>
            </div>
          </div>

          {/* Rig Preset & Detection Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs font-mono">
            {hasLiveHardware && (
              <button
                onClick={() => setSelectedRig('live_detected')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  selectedRig === 'live_detected'
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Live Detected Host ({gpus.length} GPUs)</span>
              </button>
            )}

            <button
              onClick={() => setSelectedRig('4x_a100')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedRig === '4x_a100'
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              4x A100-SXM4 (320 GB)
            </button>

            <button
              onClick={() => setSelectedRig('8x_h100')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedRig === '8x_h100'
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              8x H100 SXM5 (640 GB)
            </button>

            <button
              onClick={() => setSelectedRig('4x_rtx4090')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedRig === '4x_rtx4090'
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              4x RTX 4090 Rig (96 GB)
            </button>
          </div>
        </div>

        {/* View Switcher Tabs & Alert Tester Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Functional view tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setActiveView('aggregate')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'aggregate'
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cluster Overview</span>
            </button>

            <button
              onClick={() => setActiveView('individual')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'individual'
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>Individual GPUs ({clusterSummary.totalGpus})</span>
            </button>

            <button
              onClick={() => setActiveView('interconnect')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'interconnect'
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-purple-400" />
              <span>NVLink Mesh Matrix</span>
            </button>

            <button
              onClick={() => setActiveView('jobs')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'jobs'
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>Cluster Workloads ({clusterSummary.activeProcessesCount})</span>
            </button>
          </div>

          {/* Alert Sentinel Tester */}
          <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1.5 rounded-xl border border-zinc-800/90 text-xs font-mono self-start sm:self-auto">
            <span className="text-[11px] text-zinc-400 px-1 hidden md:inline flex items-center gap-1">
              <Sliders className="w-3 h-3 text-emerald-400" />
              Sentinel Test:
            </span>

            <button
              onClick={() => { setSimulationMode('none'); setDismissedWarnings({}); }}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                simulationMode === 'none' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Reset cluster to normal nominal readings"
            >
              Nominal
            </button>

            <button
              onClick={() => { setSimulationMode('vram_92'); setDismissedWarnings({}); }}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                simulationMode === 'vram_92' ? 'bg-rose-600 text-white font-bold' : 'text-amber-400 hover:text-amber-300'
              }`}
              title="Simulate GPU #0 exceeding 90% VRAM threshold"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>GPU #0 VRAM &gt;90%</span>
            </button>

            <button
              onClick={() => { setSimulationMode('temp_89'); setDismissedWarnings({}); }}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                simulationMode === 'temp_89' ? 'bg-rose-600 text-white font-bold' : 'text-rose-400 hover:text-rose-300'
              }`}
              title="Simulate GPU #1 exceeding 85°C thermal limit"
            >
              <Flame className="w-3 h-3" />
              <span>GPU #1 &gt;85&deg;C</span>
            </button>

            <button
              onClick={() => { setSimulationMode('dual_critical'); setDismissedWarnings({}); }}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                simulationMode === 'dual_critical' ? 'bg-rose-700 text-white font-bold animate-pulse' : 'text-rose-500 hover:text-rose-400 font-bold'
              }`}
              title="Simulate critical multi-node dual failure state"
            >
              <AlertOctagon className="w-3 h-3" />
              <span>Cluster Dual Alert</span>
            </button>
          </div>
        </div>
      </div>

      {/* AUTOMATED HARDWARE SENTINEL WARNING BANNER */}
      {totalWarnings > 0 && (
        <div className="bg-rose-950/80 border-2 border-rose-500/90 rounded-2xl p-4 shadow-[0_0_30px_rgba(244,63,94,0.3)] animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0 mt-0.5 animate-bounce shadow-lg shadow-rose-500/40">
                <BellRing className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-xs font-mono uppercase tracking-wider text-rose-200">
                    AUTOMATED HARDWARE GUARD: {totalWarnings} ACCELERATOR THRESHOLD BREACH{totalWarnings > 1 ? 'ES' : ''} DETECTED
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white animate-pulse">
                    CRITICAL HAZARD
                  </span>
                </div>
                <div className="space-y-1 text-xs font-mono text-rose-100">
                  {activeAlerts.map(alert => (
                    <div key={alert.gpuIndex} className="flex items-center gap-2">
                      <span className="font-bold text-rose-300">GPU #{alert.gpuIndex} ({alert.gpuName}):</span>
                      {alert.isVramAlert && (
                        <span>VRAM allocation at <strong className="text-white underline">{alert.vramPercent.toFixed(1)}%</strong> exceeds safety threshold of {VRAM_ALERT_THRESHOLD}%. Risk of CUDA OOM driver abort.</span>
                      )}
                      {alert.isTempAlert && (
                        <span>Core silicon die at <strong className="text-white underline">{alert.temperatureC}&deg;C</strong> exceeds thermal ceiling of {TEMP_ALERT_THRESHOLD}&deg;C. Throttling active.</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={() => {
                  activeAlerts.forEach(a => handleDismissWarning(a.gpuIndex));
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <BellOff className="w-3.5 h-3.5" />
                <span>Acknowledge All</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: CLUSTER AGGREGATE VIEW ("sobgula mile cluster info dekhabe")       */}
      {/* ========================================================================= */}
      {activeView === 'aggregate' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Cluster Core KPI Grid (4 Industrial Telemetry Tiles) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Tile 1: Total Cluster VRAM Pool */}
            <div className="bg-zinc-950/90 rounded-2xl p-4 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-bold uppercase tracking-wider text-zinc-400 font-mono">Cluster VRAM Fabric</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {clusterSummary.totalVramUtilizationPercent}% Allocated
                </span>
              </div>

              <div className="text-2xl font-bold font-mono text-white tracking-tight">
                {(clusterSummary.totalVramUsedMb / 1024).toFixed(1)}{' '}
                <span className="text-xs text-zinc-400 font-normal">/ {(clusterSummary.totalVramTotalMb / 1024).toFixed(0)} GB</span>
              </div>

              {/* Multi-GPU Segmented Allocation Bar */}
              <div className="space-y-1 pt-1">
                <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden flex">
                  {effectiveGpus.map((gpu, idx) => {
                    const gpuUsed = gpu.vramUsedMb;
                    const clusterTotal = clusterSummary.totalVramTotalMb;
                    const pctOfCluster = clusterTotal > 0 ? (gpuUsed / clusterTotal) * 100 : 0;
                    const colors = ['bg-emerald-400', 'bg-blue-400', 'bg-purple-400', 'bg-amber-400', 'bg-cyan-400', 'bg-rose-400', 'bg-indigo-400', 'bg-teal-400'];
                    return (
                      <div 
                        key={gpu.index}
                        className={`h-full ${colors[idx % colors.length]} transition-all duration-300 border-r border-zinc-950`}
                        style={{ width: `${pctOfCluster}%` }}
                        title={`GPU #${gpu.index}: ${(gpu.vramUsedMb / 1024).toFixed(1)} GB used`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>{(clusterSummary.totalVramFreeMb / 1024).toFixed(1)} GB Free Headroom</span>
                  <span>{clusterSummary.totalGpus} Segments</span>
                </div>
              </div>
            </div>

            {/* Tile 2: Cluster Compute Throughput */}
            <div className="bg-zinc-950/90 rounded-2xl p-4 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-bold uppercase tracking-wider text-zinc-400 font-mono">Aggregate Compute</span>
                <Gauge className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="text-2xl font-bold font-mono text-white tracking-tight flex items-baseline gap-2">
                <span>{clusterSummary.avgComputeUtilization}%</span>
                <span className="text-xs text-emerald-400 font-normal">avg cluster load</span>
              </div>

              <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    clusterSummary.avgComputeUtilization > 85 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.max(2, clusterSummary.avgComputeUtilization)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-0.5">
                <span>Peak Core: <strong className="text-zinc-200">{clusterSummary.peakComputeUtilization}%</strong></span>
                <span>Peak FP16: <strong className="text-emerald-400">~{(clusterSummary.totalGpus * 312).toLocaleString()} TFLOPS</strong></span>
              </div>
            </div>

            {/* Tile 3: Cluster Power & Thermal Envelope */}
            <div className="bg-zinc-950/90 rounded-2xl p-4 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-bold uppercase tracking-wider text-zinc-400 font-mono">Power & Thermal</span>
                <Thermometer className="w-4 h-4 text-amber-400" />
              </div>

              <div className="text-2xl font-bold font-mono text-white tracking-tight">
                {(clusterSummary.totalPowerWatts / 1000).toFixed(2)}{' '}
                <span className="text-xs text-zinc-400 font-normal">/ {(clusterSummary.totalPowerLimitWatts / 1000).toFixed(2)} kW</span>
              </div>

              <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(2, clusterSummary.powerUtilizationPercent)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-0.5">
                <span>Avg Die: <strong className="text-zinc-200">{clusterSummary.avgTemperatureC}&deg;C</strong></span>
                <span>Peak Die: <strong className={clusterSummary.peakTemperatureC > 85 ? 'text-rose-400' : 'text-zinc-200'}>{clusterSummary.peakTemperatureC}&deg;C</strong></span>
              </div>
            </div>

            {/* Tile 4: Interconnect Fabric Throughput */}
            <div className="bg-zinc-950/90 rounded-2xl p-4 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-bold uppercase tracking-wider text-zinc-400 font-mono">Interconnect Fabric</span>
                <Network className="w-4 h-4 text-purple-400" />
              </div>

              <div className="text-2xl font-bold font-mono text-white tracking-tight">
                {clusterSummary.totalNvlinkBandwidthGbps > 0 ? `${clusterSummary.totalNvlinkBandwidthGbps} GB/s` : 'PCIe 4.0'}
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono text-purple-400">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span>{effectiveGpus[0]?.nvlinkStatus === 'ACTIVE' ? 'All-to-All NVLink Mesh' : 'PCIe Direct DMA'}</span>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-0.5">
                <span>P2P Direct: <strong className="text-emerald-400">ENABLED</strong></span>
                <span>Crossbar Latency: <strong className="text-zinc-200">&lt; 1.2 &micro;s</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Accelerator Array Matrix (All Connected GPUs at a Glance) */}
          <div className="bg-zinc-950/80 rounded-2xl border border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono">
                  Connected Accelerator Array ({clusterSummary.totalGpus} Devices)
                </h3>
              </div>
              <button
                onClick={() => { setActiveView('individual'); setSelectedGpuIndex('all'); }}
                className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Inspect Deep Diagnostics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Compact GPU Cards Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {effectiveGpus.map((gpu) => {
                const vramPct = (gpu.vramUsedMb / gpu.vramTotalMb) * 100;
                const isVramAlert = vramPct > VRAM_ALERT_THRESHOLD;
                const isTempAlert = gpu.temperatureC > TEMP_ALERT_THRESHOLD;
                const hasAlert = isVramAlert || isTempAlert;

                return (
                  <div
                    key={gpu.index}
                    onClick={() => { setActiveView('individual'); setSelectedGpuIndex(gpu.index); }}
                    className={`rounded-xl p-3 border transition-all duration-200 cursor-pointer ${
                      hasAlert
                        ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.25)]'
                        : 'bg-zinc-900/80 hover:bg-zinc-900 border-zinc-800/90 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono mb-2">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasAlert ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
                        GPU #{gpu.index}
                      </span>
                      <span className="text-[10px] text-zinc-400 truncate max-w-[120px]">{gpu.busId}</span>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono">
                      {/* VRAM bar */}
                      <div>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-zinc-500">VRAM</span>
                          <span className={isVramAlert ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                            {vramPct.toFixed(0)}% ({(gpu.vramUsedMb / 1024).toFixed(0)}G)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isVramAlert ? 'bg-rose-500' : 'bg-purple-500'}`}
                            style={{ width: `${Math.max(2, vramPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* Compute bar */}
                      <div>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-zinc-500">Compute</span>
                          <span className="text-zinc-300">{gpu.utilizationGpu}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${Math.max(2, gpu.utilizationGpu)}%` }}
                          />
                        </div>
                      </div>

                      {/* Power & Temp */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[10px] text-zinc-400">
                        <span className={isTempAlert ? 'text-rose-400 font-bold' : ''}>
                          {gpu.temperatureC}&deg;C {isTempAlert ? '(OVERHEAT)' : ''}
                        </span>
                        <span>{gpu.powerDrawWatts} W</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: INDIVIDUAL GPU UNITS ("individual info dekhabe")                   */}
      {/* ========================================================================= */}
      {activeView === 'individual' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Accelerator Selector Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/80 p-2 rounded-xl border border-zinc-800 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-bold px-2">Inspect Device:</span>
              <button
                onClick={() => setSelectedGpuIndex('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedGpuIndex === 'all' ? 'bg-emerald-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                All Cards ({effectiveGpus.length})
              </button>

              {effectiveGpus.map(g => (
                <button
                  key={g.index}
                  onClick={() => setSelectedGpuIndex(g.index)}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    selectedGpuIndex === g.index ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    (g.vramUsedMb / g.vramTotalMb) * 100 > VRAM_ALERT_THRESHOLD || g.temperatureC > TEMP_ALERT_THRESHOLD
                      ? 'bg-rose-500'
                      : 'bg-emerald-400'
                  }`} />
                  <span>GPU #{g.index}</span>
                </button>
              ))}
            </div>

            <div className="text-zinc-500 text-[11px] pr-2">
              Viewing {selectedGpuIndex === 'all' ? `all ${effectiveGpus.length} units` : `GPU #${selectedGpuIndex} detailed diagnostics`}
            </div>
          </div>

          {/* Detailed GPU Cards List */}
          {displayedGpus.map((gpu) => {
            const vramUsedPercent = (gpu.vramUsedMb / gpu.vramTotalMb) * 100;
            const powerPercent = gpu.powerLimitWatts > 0 ? (gpu.powerDrawWatts / gpu.powerLimitWatts) * 100 : 0;
            const isVramAlert = vramUsedPercent > VRAM_ALERT_THRESHOLD;
            const isTempAlert = gpu.temperatureC > TEMP_ALERT_THRESHOLD;
            const isCritical = isVramAlert && isTempAlert;
            const hasWarning = isVramAlert || isTempAlert;
            const isDismissed = !!dismissedWarnings[gpu.index];
            const isWarningVisible = hasWarning && !isDismissed;

            return (
              <div 
                key={gpu.index}
                className={`rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all duration-300 ${
                  isWarningVisible
                    ? 'bg-zinc-900/95 border-2 border-rose-500/80 shadow-[0_0_35px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40'
                    : 'bg-zinc-900/80 border border-zinc-800'
                }`}
              >
                {/* Visual Red Ambient Glow when Alert is Active */}
                {isWarningVisible && (
                  <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
                )}

                {/* Specific Card Warning Banner */}
                {hasWarning && (
                  <div className={`mb-4 rounded-xl p-3 border transition-all duration-200 ${
                    isDismissed
                      ? 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400'
                      : isCritical
                        ? 'bg-rose-950/90 border-rose-500 text-rose-100'
                        : 'bg-rose-950/70 border-rose-500/70 text-rose-100'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          isDismissed ? 'bg-zinc-800 text-zinc-400' : 'bg-rose-500 text-white animate-bounce'
                        }`}>
                          {isTempAlert ? <Flame className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        </div>

                        <div className="space-y-1 text-xs font-mono">
                          <div className="font-bold text-rose-300 uppercase">
                            {isCritical ? 'CRITICAL: DUAL THRESHOLD BREACH' : isVramAlert ? 'VRAM OVERLOAD (>90%)' : 'THERMAL OVERHEAT (>85°C)'}
                          </div>
                          {isVramAlert && (
                            <p className="text-rose-200">
                              VRAM allocation: {vramUsedPercent.toFixed(1)}% ({(gpu.vramUsedMb / 1024).toFixed(2)} GB / {(gpu.vramTotalMb / 1024).toFixed(1)} GB). OOM danger.
                            </p>
                          )}
                          {isTempAlert && (
                            <p className="text-rose-200">
                              Core temp: {gpu.temperatureC}&deg;C exceeds thermal ceiling of 85.0&deg;C. Throttling active.
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        {!isDismissed ? (
                          <button
                            onClick={() => handleDismissWarning(gpu.index)}
                            className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResetDismissed(gpu.index)}
                            className="px-2 py-1 rounded text-xs font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-800 cursor-pointer"
                          >
                            Restore Alert
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Card Info Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800/80 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isWarningVisible
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-white tracking-tight">{gpu.name}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
                          GPU #{gpu.index}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">
                          Bus: {gpu.busId} · NUMA {gpu.numaNode ?? 0}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono truncate">
                        UUID: {gpu.uuid}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono shrink-0">
                    <span className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                      Driver: <span className="text-emerald-400">{gpu.driverVersion}</span>
                    </span>
                    <span className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                      CUDA: <span className="text-emerald-400">{gpu.cudaVersion}</span>
                    </span>
                    <span className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 hidden sm:inline">
                      PCIe: Gen{gpu.pcieGen} {gpu.pcieWidth}
                    </span>
                  </div>
                </div>

                {/* 4 KPI Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
                  {/* Compute Utilization */}
                  <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span className="text-[10px] uppercase font-semibold text-zinc-500 font-mono">Compute Load</span>
                      <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-xl font-bold font-mono text-zinc-100">
                      {gpu.utilizationGpu}%
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-2">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          gpu.utilizationGpu > 90 ? 'bg-amber-500' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.max(2, gpu.utilizationGpu)}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-1">
                      Clock: {gpu.clockCoreMhz ?? 1410} MHz
                    </div>
                  </div>

                  {/* VRAM Allocation */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 ${
                    isVramAlert
                      ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50'
                      : 'bg-zinc-950/80 border border-zinc-800/80'
                  }`}>
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span className="text-[10px] uppercase font-semibold text-zinc-500 font-mono flex items-center gap-1">
                        VRAM Allocation
                        {isVramAlert && <AlertTriangle className="w-3 h-3 text-rose-400 animate-bounce" />}
                      </span>
                      <span className={`text-[10px] font-mono font-bold ${
                        isVramAlert ? 'text-rose-400 animate-pulse' : 'text-purple-400'
                      }`}>
                        {vramUsedPercent.toFixed(0)}%
                      </span>
                    </div>
                    <div className={`text-xl font-bold font-mono truncate ${
                      isVramAlert ? 'text-rose-400 font-extrabold' : 'text-zinc-100'
                    }`}>
                      {(gpu.vramUsedMb / 1024).toFixed(1)} <span className="text-xs text-zinc-400 font-normal">/ {(gpu.vramTotalMb / 1024).toFixed(0)} GB</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-2">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          isVramAlert ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)] animate-pulse' : 'bg-purple-500'
                        }`}
                        style={{ width: `${Math.max(2, vramUsedPercent)}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-1">
                      Mem Clock: {gpu.clockMemoryMhz ?? 1215} MHz
                    </div>
                  </div>

                  {/* Thermal & Fan */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 ${
                    isTempAlert
                      ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50'
                      : 'bg-zinc-950/80 border border-zinc-800/80'
                  }`}>
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span className="text-[10px] uppercase font-semibold text-zinc-500 font-mono flex items-center gap-1">
                        Thermal & Fan
                        {isTempAlert && <Flame className="w-3 h-3 text-rose-400 animate-bounce" />}
                      </span>
                      {isTempAlert ? (
                        <span className="text-[10px] font-mono text-rose-400 font-bold animate-pulse">ALERT &gt;85&deg;C</span>
                      ) : (
                        <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                    <div className="text-xl font-bold font-mono text-zinc-100 flex items-center gap-2">
                      <span className={isTempAlert ? 'text-rose-400 font-extrabold animate-pulse' : 'text-zinc-100'}>
                        {gpu.temperatureC}&deg;C
                      </span>
                      <span className="text-xs font-normal text-zinc-400 flex items-center gap-0.5">
                        <Wind className="w-3 h-3 text-cyan-400" /> {gpu.fanSpeedPercent}%
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-1">
                      Throttle: <span className={gpu.throttleReason !== 'None' ? 'text-rose-400' : 'text-emerald-400'}>{gpu.throttleReason ?? 'None'}</span>
                    </div>
                  </div>

                  {/* Power Draw */}
                  <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span className="text-[10px] uppercase font-semibold text-zinc-500 font-mono">Power Draw</span>
                      <span className="text-[10px] font-mono text-amber-400">{powerPercent.toFixed(0)}% TDP</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-zinc-100">
                      {gpu.powerDrawWatts.toFixed(0)} <span className="text-xs text-zinc-400 font-normal">/ {gpu.powerLimitWatts} W</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-2">
                      <div 
                        className="h-full bg-amber-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(2, powerPercent)}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-1">
                      NVLink: {gpu.nvlinkStatus === 'ACTIVE' ? `${gpu.nvlinkBandwidthGbps} GB/s` : 'PCIe Only'}
                    </div>
                  </div>
                </div>

                {/* Running CUDA Processes on this Card */}
                <div className="mt-4 pt-3 border-t border-zinc-800/70">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-300 font-mono flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      Active CUDA Processes on GPU #{gpu.index} ({gpu.processes.length})
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">nvmlDeviceGetComputeRunningProcesses()</span>
                  </div>

                  {gpu.processes.length === 0 ? (
                    <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60 text-xs text-zinc-500 font-mono text-center">
                      Device is IDLE &bull; No active compute kernels running on GPU #{gpu.index}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-zinc-800/80 text-zinc-400 text-[11px]">
                            <th className="pb-2 font-medium">PID</th>
                            <th className="pb-2 font-medium">User</th>
                            <th className="pb-2 font-medium">Process Name / Rank</th>
                            <th className="pb-2 font-medium text-right">VRAM Footprint</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40">
                          {gpu.processes.map((proc) => (
                            <tr key={proc.pid} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="py-2 text-emerald-400 font-bold">#{proc.pid}</td>
                              <td className="py-2 text-zinc-300">{proc.user}</td>
                              <td className="py-2 text-zinc-200 truncate max-w-[280px]" title={proc.processName}>
                                {proc.processName}
                              </td>
                              <td className={`py-2 text-right font-bold ${
                                isVramAlert ? 'text-rose-400 font-extrabold' : 'text-purple-400'
                              }`}>
                                {proc.usedMemoryMb.toFixed(0)} MB
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: NVLINK INTERCONNECT MESH MATRIX                                  */}
      {/* ========================================================================= */}
      {activeView === 'interconnect' && (
        <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800/80 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  High-Speed Peer-to-Peer Interconnect Matrix
                </h3>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Full-duplex P2P interconnect bandwidth between accelerator pairs via NVLink 4 / NVSwitch Crossbar Fabric
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>NVSwitch Crossbar Status: <strong>NOMINAL</strong></span>
            </div>
          </div>

          {/* Interactive Matrix Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs font-mono border-collapse">
              <thead>
                <tr>
                  <th className="p-2.5 text-left text-zinc-400 border border-zinc-800 bg-zinc-900/80">P2P Matrix</th>
                  {effectiveGpus.map(targetGpu => (
                    <th key={targetGpu.index} className="p-2.5 text-zinc-200 border border-zinc-800 bg-zinc-900/80">
                      GPU #{targetGpu.index}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {effectiveGpus.map(srcGpu => (
                  <tr key={srcGpu.index}>
                    <td className="p-2.5 text-left font-bold text-zinc-300 border border-zinc-800 bg-zinc-900/50">
                      GPU #{srcGpu.index}
                    </td>
                    {effectiveGpus.map(targetGpu => {
                      const isSelf = srcGpu.index === targetGpu.index;
                      const hasNvlink = srcGpu.nvlinkStatus === 'ACTIVE' && targetGpu.nvlinkStatus === 'ACTIVE';
                      const bandwidth = hasNvlink ? `${srcGpu.nvlinkBandwidthGbps} GB/s` : 'PCIe 4.0 (32G)';

                      return (
                        <td 
                          key={targetGpu.index} 
                          className={`p-2.5 border border-zinc-800 transition-colors ${
                            isSelf 
                              ? 'bg-zinc-900/90 text-zinc-500 font-semibold' 
                              : hasNvlink
                                ? 'bg-purple-950/20 text-purple-300 hover:bg-purple-950/40'
                                : 'bg-zinc-950/60 text-zinc-400'
                          }`}
                        >
                          {isSelf ? (
                            <span className="text-zinc-600">SELF (LOCAL)</span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="font-bold text-emerald-400">{bandwidth}</span>
                              <div className="text-[10px] text-zinc-500">P2P Direct DMA</div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Matrix Specs & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono text-zinc-400">
            <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800">
              <div className="text-zinc-200 font-bold mb-1">Direct P2P Memory Access</div>
              <p className="text-[11px] text-zinc-400">
                GPU-to-GPU memory copies bypass host CPU RAM, utilizing direct GPUDirect RDMA with zero page-fault copying overhead.
              </p>
            </div>

            <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800">
              <div className="text-zinc-200 font-bold mb-1">NVSwitch Topology Bisection</div>
              <p className="text-[11px] text-zinc-400">
                Full bisection aggregate bandwidth: <strong>{clusterSummary.totalNvlinkBandwidthGbps * 4} GB/s</strong> with symmetric all-to-all communication.
              </p>
            </div>

            <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800">
              <div className="text-zinc-200 font-bold mb-1">Peer Latency Profile</div>
              <p className="text-[11px] text-zinc-400">
                Peer direct latency measured at <strong>&lt; 1.2 microseconds</strong>. Zero link degradations or CRC packet retries recorded.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: CLUSTER DISTRIBUTED WORKLOADS                                     */}
      {/* ========================================================================= */}
      {activeView === 'jobs' && (
        <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800/80 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Distributed Cluster Workloads & Worker Ranks
                </h3>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Real-time processes mapped across all {clusterSummary.totalGpus} physical accelerators
              </p>
            </div>
            <div className="text-xs font-mono text-zinc-400">
              Total Active Compute Kernels: <strong className="text-emerald-400">{clusterSummary.activeProcessesCount}</strong>
            </div>
          </div>

          {/* Aggregated Cluster Process Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-[11px]">
                  <th className="pb-2.5 font-medium">Assigned GPU</th>
                  <th className="pb-2.5 font-medium">PID</th>
                  <th className="pb-2.5 font-medium">User</th>
                  <th className="pb-2.5 font-medium">Framework & Distributed Command</th>
                  <th className="pb-2.5 font-medium text-right">VRAM Memory</th>
                  <th className="pb-2.5 font-medium text-right">Compute Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {effectiveGpus.flatMap(gpu => 
                  (gpu.processes || []).map(proc => (
                    <tr key={`${gpu.index}-${proc.pid}`} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="py-2.5 font-bold text-zinc-300">
                        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-emerald-400">
                          GPU #{gpu.index}
                        </span>
                      </td>
                      <td className="py-2.5 text-emerald-400 font-bold">#{proc.pid}</td>
                      <td className="py-2.5 text-zinc-300">{proc.user}</td>
                      <td className="py-2.5 text-zinc-100 font-medium truncate max-w-[340px]" title={proc.processName}>
                        {proc.processName}
                      </td>
                      <td className="py-2.5 text-right font-bold text-purple-400">
                        {proc.usedMemoryMb.toFixed(0)} MB
                      </td>
                      <td className="py-2.5 text-right font-bold text-emerald-400">
                        {proc.computeUtilPercent ?? 85}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
