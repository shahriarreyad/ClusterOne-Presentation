import { 
  NodeProfile, 
  ClusterKpis, 
  AlertRecord, 
  TimeSeriesPoint, 
  SystemHealthInfo,
  HeartbeatPayload 
} from '../types';

export interface ClientHardwareInfo {
  browserGpuRenderer: string;
  logicalCores: number;
  deviceMemoryGb?: number;
  networkType?: string;
  downlinkSpeedMbps?: number;
  roundTripTimeMs?: number;
  heapUsedMb?: number;
  heapTotalMb?: number;
}

// 1. Fetch Cluster Aggregate KPIs
export async function fetchClusterKpis(): Promise<ClusterKpis> {
  const res = await fetch('/api/v1/cluster');
  if (!res.ok) {
    throw new Error(`Failed to fetch cluster KPIs: ${res.statusText}`);
  }
  return res.json();
}

// 2. Fetch All Real Registered Nodes
export async function fetchRegisteredNodes(): Promise<NodeProfile[]> {
  const res = await fetch('/api/v1/nodes');
  if (!res.ok) {
    throw new Error(`Failed to fetch nodes: ${res.statusText}`);
  }
  const data = await res.json();
  return data.nodes || [];
}

// 3. Fetch Single Node Detail
export async function fetchNodeDetail(nodeId: string): Promise<NodeProfile> {
  const res = await fetch(`/api/v1/nodes/${encodeURIComponent(nodeId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch node ${nodeId}: ${res.statusText}`);
  }
  const data = await res.json();
  return data.node;
}

// 4. Fetch Real Workloads / Processes Across All Nodes
export async function fetchWorkloads(): Promise<any[]> {
  const res = await fetch('/api/v1/workloads');
  if (!res.ok) {
    throw new Error(`Failed to fetch workloads: ${res.statusText}`);
  }
  const data = await res.json();
  return data.processes || [];
}

// 5. Fetch Real Alerts
export async function fetchAlerts(): Promise<AlertRecord[]> {
  const res = await fetch('/api/v1/alerts');
  if (!res.ok) {
    throw new Error(`Failed to fetch alerts: ${res.statusText}`);
  }
  const data = await res.json();
  return data.alerts || [];
}

// 6. Acknowledge Alert
export async function acknowledgeAlert(alertId: string): Promise<boolean> {
  const res = await fetch(`/api/v1/alerts/${encodeURIComponent(alertId)}/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.ok;
}

// 7. Fetch Real Historical Telemetry Points (Stored Ring Buffer)
export async function fetchHistoricalTelemetry(params: {
  nodeId?: string;
  gpuIndex?: number;
  range?: string;
}): Promise<{ available: boolean; points: TimeSeriesPoint[]; range: string }> {
  const query = new URLSearchParams();
  if (params.nodeId) query.set('nodeId', params.nodeId);
  if (params.gpuIndex !== undefined) query.set('gpuIndex', params.gpuIndex.toString());
  if (params.range) query.set('range', params.range);

  const res = await fetch(`/api/v1/telemetry/history?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch historical telemetry: ${res.statusText}`);
  }
  return res.json();
}

// 8. Fetch Platform Self-Observability System Health
export async function fetchSystemHealth(): Promise<SystemHealthInfo> {
  const res = await fetch('/api/v1/system-health');
  if (!res.ok) {
    throw new Error(`Failed to fetch system health: ${res.statusText}`);
  }
  return res.json();
}

// 9. Fetch Prometheus Metrics
export async function fetchPrometheusMetrics(): Promise<string> {
  const res = await fetch('/api/v1/metrics');
  if (!res.ok) {
    throw new Error(`Failed to fetch metrics: ${res.statusText}`);
  }
  return res.text();
}

// 10. Fetch Healthz Probe
export async function fetchHealthz(): Promise<any> {
  const res = await fetch('/api/v1/healthz');
  if (!res.ok) {
    throw new Error(`Healthz probe failed: ${res.statusText}`);
  }
  return res.json();
}

// 11. Connect Live SSE Telemetry Stream
export function connectTelemetryStream(
  onData: (data: { type: string; timestamp: string; nodes: NodeProfile[]; alerts: AlertRecord[] }) => void,
  onStatusChange?: (status: 'CONNECTED' | 'RECONNECTING' | 'ERROR') => void
): () => void {
  let eventSource: EventSource | null = null;
  let isClosed = false;
  let retryTimeout: any = null;

  function connect() {
    if (isClosed) return;
    try {
      eventSource = new EventSource('/api/v1/telemetry/stream');
      
      eventSource.onopen = () => {
        if (onStatusChange) onStatusChange('CONNECTED');
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onData(payload);
        } catch (err) {
          // ignore heartbeat comments
        }
      };

      eventSource.onerror = () => {
        if (onStatusChange) onStatusChange('RECONNECTING');
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          retryTimeout = setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      if (onStatusChange) onStatusChange('ERROR');
      if (!isClosed) {
        retryTimeout = setTimeout(connect, 5000);
      }
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (eventSource) eventSource.close();
  };
}

export function detectClientHardware(): ClientHardwareInfo {
  let gpuRenderer = 'Standard Display Adapter';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || gpuRenderer;
      }
    }
  } catch (err) {
    // Canvas WebGL unavailable
  }

  const logicalCores = navigator.hardwareConcurrency || 4;
  const nav = navigator as any;
  const deviceMemoryGb = nav.deviceMemory ? Number(nav.deviceMemory) : undefined;
  
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const networkType = conn?.effectiveType || undefined;
  const downlinkSpeedMbps = conn?.downlink ? Number(conn.downlink) : undefined;
  const roundTripTimeMs = conn?.rtt ? Number(conn.rtt) : undefined;

  let heapUsedMb: number | undefined;
  let heapTotalMb: number | undefined;
  const perf = performance as any;
  if (perf && perf.memory) {
    heapUsedMb = Math.round(perf.memory.usedJSHeapSize / (1024 * 1024));
    heapTotalMb = Math.round(perf.memory.totalJSHeapSize / (1024 * 1024));
  }

  return {
    browserGpuRenderer: gpuRenderer,
    logicalCores,
    deviceMemoryGb,
    networkType,
    downlinkSpeedMbps,
    roundTripTimeMs,
    heapUsedMb,
    heapTotalMb,
  };
}
