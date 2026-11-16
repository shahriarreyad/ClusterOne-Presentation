import React, { useState } from 'react';
import { X, Copy, Check, FileJson, ArrowRight, Database, Server, Activity, HeartPulse } from 'lucide-react';
import { HeartbeatPayload } from '../types';

interface JsonInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: HeartbeatPayload;
}

type TabType = 'JSON' | 'PROMETHEUS' | 'HEALTHZ';

export const JsonInspectorModal: React.FC<JsonInspectorModalProps> = ({
  isOpen,
  onClose,
  payload,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('JSON');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const jsonString = JSON.stringify(payload, null, 2);

  const generatePrometheusMetrics = (p: HeartbeatPayload): string => {
    const lines: string[] = [
      '# HELP clusterone_node_info Host metadata and operating system',
      '# TYPE clusterone_node_info gauge',
      `clusterone_node_info{node_id="${p.nodeId}",hostname="${p.hostname}",os="${p.os}",kernel="${p.kernel}",agent_version="${p.agentVersion}"} 1`,
      '',
      '# HELP clusterone_node_status Current operational status (1=ONLINE, 2=BUSY, 3=DRAINING, 0=OFFLINE)',
      '# TYPE clusterone_node_status gauge',
      `clusterone_node_status{node_id="${p.nodeId}"} ${p.status === 'ONLINE' ? 1 : p.status === 'BUSY' ? 2 : p.status === 'DRAINING' ? 3 : 0}`,
      '',
      '# HELP clusterone_node_uptime_seconds System uptime in seconds',
      '# TYPE clusterone_node_uptime_seconds counter',
      `clusterone_node_uptime_seconds{node_id="${p.nodeId}"} ${p.uptimeSeconds}`,
      '',
      '# HELP clusterone_node_cpu_utilization_ratio CPU core utilization ratio (0.0 - 1.0)',
      '# TYPE clusterone_node_cpu_utilization_ratio gauge',
      `clusterone_node_cpu_utilization_ratio{node_id="${p.nodeId}"} ${(p.cpu.utilization / 100).toFixed(4)}`,
      '',
      '# HELP clusterone_node_cpu_load_average System load average',
      '# TYPE clusterone_node_cpu_load_average gauge',
      `clusterone_node_cpu_load_average{node_id="${p.nodeId}",period="1m"} ${p.cpu.loadAvg[0]}`,
      `clusterone_node_cpu_load_average{node_id="${p.nodeId}",period="5m"} ${p.cpu.loadAvg[1]}`,
      `clusterone_node_cpu_load_average{node_id="${p.nodeId}",period="15m"} ${p.cpu.loadAvg[2]}`,
      '',
      '# HELP clusterone_node_memory_used_bytes Physical RAM consumed in bytes',
      '# TYPE clusterone_node_memory_used_bytes gauge',
      `clusterone_node_memory_used_bytes{node_id="${p.nodeId}"} ${Math.round(p.ram.usedGb * 1024 * 1024 * 1024)}`,
      '',
      '# HELP clusterone_node_memory_total_bytes Total physical RAM in bytes',
      '# TYPE clusterone_node_memory_total_bytes gauge',
      `clusterone_node_memory_total_bytes{node_id="${p.nodeId}"} ${Math.round(p.ram.totalGb * 1024 * 1024 * 1024)}`,
      '',
    ];

    p.gpus.forEach((gpu) => {
      lines.push(
        '# HELP clusterone_gpu_utilization_ratio NVIDIA GPU active compute core ratio',
        '# TYPE clusterone_gpu_utilization_ratio gauge',
        `clusterone_gpu_utilization_ratio{node_id="${p.nodeId}",gpu="${gpu.index}",model="${gpu.name.replace(/ /g, '_')}",uuid="${gpu.uuid}"} ${(gpu.utilizationGpu / 100).toFixed(4)}`,
        '',
        '# HELP clusterone_gpu_memory_used_bytes NVIDIA VRAM used in bytes',
        '# TYPE clusterone_gpu_memory_used_bytes gauge',
        `clusterone_gpu_memory_used_bytes{node_id="${p.nodeId}",gpu="${gpu.index}"} ${gpu.vramUsedMb * 1024 * 1024}`,
        '',
        '# HELP clusterone_gpu_temperature_celsius NVIDIA GPU die temperature in Celsius',
        '# TYPE clusterone_gpu_temperature_celsius gauge',
        `clusterone_gpu_temperature_celsius{node_id="${p.nodeId}",gpu="${gpu.index}"} ${gpu.temperatureC}`,
        '',
        '# HELP clusterone_gpu_power_draw_watts NVIDIA GPU active power draw',
        '# TYPE clusterone_gpu_power_draw_watts gauge',
        `clusterone_gpu_power_draw_watts{node_id="${p.nodeId}",gpu="${gpu.index}"} ${gpu.powerDrawWatts}`,
        ''
      );
    });

    p.disks.forEach((disk) => {
      lines.push(
        `clusterone_disk_used_bytes{node_id="${p.nodeId}",mount="${disk.path}"} ${Math.round(disk.usedGb * 1024 * 1024 * 1024)}`,
        `clusterone_disk_total_bytes{node_id="${p.nodeId}",mount="${disk.path}"} ${Math.round(disk.totalGb * 1024 * 1024 * 1024)}`
      );
    });

    lines.push(
      '',
      '# HELP clusterone_agent_heartbeat_seq_total Monotonically increasing heartbeat counter',
      '# TYPE clusterone_agent_heartbeat_seq_total counter',
      `clusterone_agent_heartbeat_seq_total{node_id="${p.nodeId}"} ${p.sequence}`
    );

    return lines.join('\n');
  };

  const generateHealthzJson = (p: HeartbeatPayload): string => {
    return JSON.stringify({
      status: p.status === 'ERROR' ? 'DEGRADED' : 'HEALTHY',
      nodeId: p.nodeId,
      timestamp: p.timestamp,
      agentVersion: p.agentVersion,
      checks: {
        nvml_gpu_subsystem: {
          status: p.gpus.length > 0 ? 'PASS' : 'WARN',
          devicesFound: p.gpus.length,
          driver: p.gpus[0]?.driverVersion || 'N/A',
          cuda: p.gpus[0]?.cudaVersion || 'N/A'
        },
        scratch_storage: {
          status: p.disks.some(d => d.path === '/scratch' && !d.isReadOnly) ? 'PASS' : 'FAIL',
          mount: '/scratch',
          freeGb: p.disks.find(d => d.path === '/scratch')?.freeGb || 0
        },
        controller_tls_link: {
          status: p.status === 'OFFLINE' ? 'FAIL' : 'PASS',
          endpoint: 'https://controller.clusterone.local:8080/api/v1',
          tlsVersion: 'TLSv1.3',
          latencyMs: p.network.latencyToControllerMs
        },
        apptainer_runtime: {
          status: 'PASS',
          binary: '/usr/bin/apptainer',
          cgroupsV2: true,
          rootlessNamespace: true
        }
      }
    }, null, 2);
  };

  const prometheusString = generatePrometheusMetrics(payload);
  const healthzString = generateHealthzJson(payload);

  const getCurrentContent = () => {
    switch (activeTab) {
      case 'PROMETHEUS': return prometheusString;
      case 'HEALTHZ': return healthzString;
      default: return jsonString;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <FileJson className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">Agent Telemetry & Exporter Contracts</h3>
              <p className="text-xs text-zinc-400 font-mono truncate">
                Standard interfaces emitted by the host daemon for Controller, Prometheus, and Health Probes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-zinc-950/80 px-4 py-2 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('JSON')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'JSON'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>POST /heartbeat (REST JSON)</span>
          </button>

          <button
            onClick={() => setActiveTab('PROMETHEUS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'PROMETHEUS'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>GET :9100/metrics (Prometheus)</span>
          </button>

          <button
            onClick={() => setActiveTab('HEALTHZ')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'HEALTHZ'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span>GET :8080/healthz (K8s Probe)</span>
          </button>
        </div>

        {/* HTTP Header Meta Banner */}
        <div className="bg-black/60 px-5 py-2 border-b border-zinc-800 text-[11px] font-mono text-zinc-400 flex flex-wrap items-center justify-between gap-2">
          <div>
            {activeTab === 'JSON' && (
              <>
                <span className="text-emerald-400 font-bold">POST</span> /api/v1/nodes/heartbeat HTTP/1.1 &bull;{' '}
                <span className="text-zinc-500">Authorization:</span> <span className="text-zinc-300">Bearer c1-node-secret-prod-****************</span>
              </>
            )}
            {activeTab === 'PROMETHEUS' && (
              <>
                <span className="text-emerald-400 font-bold">GET</span> :9100/metrics HTTP/1.1 &bull;{' '}
                <span className="text-zinc-500">Content-Type:</span> <span className="text-zinc-300">text/plain; version=0.0.4</span>
              </>
            )}
            {activeTab === 'HEALTHZ' && (
              <>
                <span className="text-emerald-400 font-bold">GET</span> /healthz HTTP/1.1 &bull;{' '}
                <span className="text-zinc-500">Response:</span> <span className="text-emerald-400 font-semibold">200 OK</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
            OWASP Compliant & Masked
          </span>
        </div>

        {/* Content Viewer */}
        <div className="p-4 overflow-y-auto flex-1 bg-zinc-950 font-mono text-xs text-zinc-300">
          <pre className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 text-emerald-400 overflow-x-auto leading-relaxed">
            {getCurrentContent()}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>
            {activeTab === 'JSON' && `Payload Size: ~${(jsonString.length / 1024).toFixed(1)} KB • Interval: 5,000ms`}
            {activeTab === 'PROMETHEUS' && 'Standard OpenMetrics format scrapable by Prometheus server / Grafana Agent'}
            {activeTab === 'HEALTHZ' && 'Kubernetes / systemd liveness and readiness probe endpoint'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
