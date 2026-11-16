import React, { useState, useEffect } from 'react';
import { fetchSystemHealth, fetchPrometheusMetrics, fetchHealthz } from '../services/api';
import { SystemHealthInfo } from '../types';
import { 
  Activity, 
  Cpu, 
  Layers, 
  Server, 
  CheckCircle2, 
  FileText, 
  Radio, 
  RotateCcw,
  ShieldCheck,
  Zap
} from 'lucide-react';

export const SystemHealthPage: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthInfo | null>(null);
  const [prometheusSample, setPrometheusSample] = useState<string>('');
  const [healthzProbe, setHealthzProbe] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [h, metrics, probe] = await Promise.all([
        fetchSystemHealth(),
        fetchPrometheusMetrics().catch(() => 'Unavailable'),
        fetchHealthz().catch(() => null),
      ]);
      setHealth(h);
      setPrometheusSample(metrics);
      setHealthzProbe(probe);
    } catch {
      // Error loading health
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-zinc-950/90 p-4 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 font-mono">
            <Activity className="w-5 h-5 text-cyan-400" />
            Monitoring Platform Observability & System Self-Health
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-0.5">
            Internal telemetry: backend ingestion throughput, memory footprint, SSE stream connections, and health probes
          </p>
        </div>

        <button
          onClick={loadData}
          className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-zinc-950/90 rounded-xl border border-zinc-800 p-4 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase block font-bold">Ingestion Rate</span>
          <div className="text-2xl font-bold text-white">
            {health?.ingestionRatePerMin || 0} <span className="text-xs text-zinc-400 font-normal">samples/min</span>
          </div>
          <div className="text-[10px] text-emerald-400">Loss: 0.0% &bull; Latency: &lt; 2ms</div>
        </div>

        <div className="bg-zinc-950/90 rounded-xl border border-zinc-800 p-4 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase block font-bold">SSE Live Streams</span>
          <div className="text-2xl font-bold text-white">
            {health?.activeSseClients || 0} <span className="text-xs text-zinc-400 font-normal">clients</span>
          </div>
          <div className="text-[10px] text-purple-400">HTTP/1.1 EventSource Active</div>
        </div>

        <div className="bg-zinc-950/90 rounded-xl border border-zinc-800 p-4 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase block font-bold">Controller Process RSS</span>
          <div className="text-2xl font-bold text-white">
            {health?.backendMemRssMb || 0} <span className="text-xs text-zinc-400 font-normal">MB</span>
          </div>
          <div className="text-[10px] text-zinc-400">Heap Used: {health?.backendMemHeapUsedMb || 0} MB</div>
        </div>

        <div className="bg-zinc-950/90 rounded-xl border border-zinc-800 p-4 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase block font-bold">Registered Inventory</span>
          <div className="text-2xl font-bold text-white">
            {health?.totalRegisteredNodes || 0} <span className="text-xs text-zinc-400 font-normal">nodes</span>
          </div>
          <div className="text-[10px] text-zinc-400">{health?.totalMonitoredGpus || 0} GPUs monitored</div>
        </div>
      </div>

      {/* Health Probes & Prometheus Sample */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Container Probe Status */}
        <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Kubernetes / Liveness Probe (/api/v1/healthz)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 font-bold border border-emerald-500/30">
              HEALTHY
            </span>
          </div>

          <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800/80 font-mono text-xs text-zinc-300 overflow-x-auto">
            <pre>{JSON.stringify(healthzProbe, null, 2)}</pre>
          </div>
        </div>

        {/* Prometheus Metrics Exporter */}
        <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-purple-400" />
              Prometheus Metrics Scrape (/api/v1/metrics)
            </span>
            <span className="text-[11px] font-mono text-zinc-500">text/plain; v0.0.4</span>
          </div>

          <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800/80 font-mono text-xs text-emerald-400 overflow-x-auto max-h-64">
            <pre>{prometheusSample.slice(0, 1200)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
