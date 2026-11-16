/**
 * ============================================================================
 * ClusterOne Enterprise Telemetry Types & Contract Schema
 * ============================================================================
 * Strongly typed schema for real GPU cluster nodes, hardware sensors,
 * alert engine, time-series history, and cluster topology.
 */

export type NodeStatus = 'ONLINE' | 'BUSY' | 'DRAINING' | 'DEGRADED' | 'WARNING' | 'CRITICAL' | 'OFFLINE' | 'STALE' | 'MAINTENANCE' | 'ERROR';

export interface ActiveJob {
  id: string;
  name: string;
  user: string;
  framework: string;
  gpuIndices: number[];
  vramAllocatedMb: number;
  uptimeSeconds: number;
  status: 'RUNNING' | 'STAGING' | 'COMPLETED' | 'FAILED';
  containerId?: string;
  containerImage?: string;
}

export interface AgentLogMessage {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  source: string;
  message: string;
}

export interface GpuClusterSummary {
  totalGpus: number;
  onlineGpus: number;
  totalVramTotalMb: number;
  totalVramUsedMb: number;
  totalVramFreeMb: number;
  totalVramUtilizationPercent: number;
  avgComputeUtilization: number;
  peakComputeUtilization: number;
  avgTemperatureC: number;
  peakTemperatureC: number;
  totalPowerWatts: number;
  totalPowerLimitWatts: number;
  powerUtilizationPercent: number;
  totalNvlinkBandwidthGbps: number;
  activeProcessesCount: number;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export type TimeRange = '5m' | '1h' | '6h' | '24h' | '7d';

export interface GpuProcess {
  pid: number;
  processName: string;
  usedMemoryMb: number;
  user: string;
  rank?: number;
  computeUtilPercent?: number;
  runtimeSeconds?: number;
}

export interface GpuEccErrors {
  singleBit: number;
  doubleBit: number;
  aggregateUncorrectable: number;
}

export interface GpuInfo {
  index: number;
  name: string;
  uuid: string;
  busId?: string;
  numaNode?: number;
  serial?: string;
  driverVersion: string;
  cudaVersion: string;
  computeCapability?: string;
  vramTotalMb: number;
  vramUsedMb: number;
  vramFreeMb: number;
  utilizationGpu: number;
  utilizationMemory: number;
  temperatureC: number;
  fanSpeedPercent: number;
  powerDrawWatts: number;
  powerLimitWatts: number;
  clockCoreMhz?: number;
  clockMemoryMhz?: number;
  pcieGen: number;
  pcieWidth: string;
  nvlinkStatus?: 'ACTIVE' | 'INACTIVE' | 'DEGRADED';
  nvlinkBandwidthGbps?: number;
  throttleReason?: string;
  encoderUtilPercent?: number;
  decoderUtilPercent?: number;
  eccErrors?: GpuEccErrors;
  xidErrors?: string[];
  processes: GpuProcess[];
}

export interface CpuInfo {
  model: string;
  cores: number;
  threads: number;
  utilization: number;
  perCoreUsage: number[];
  frequencyGhz: number;
  temperatureC?: number;
  loadAvg: [number, number, number];
  governor?: string;
}

export interface RamInfo {
  totalGb: number;
  usedGb: number;
  freeGb: number;
  cachedGb: number;
  swapUsedGb: number;
  swapTotalGb: number;
  utilizationPercent?: number;
}

export interface DiskMount {
  path: string;
  device: string;
  fstype: string;
  totalGb: number;
  usedGb: number;
  freeGb: number;
  readThroughputMBs: number;
  writeThroughputMBs: number;
  iops?: number;
  isReadOnly: boolean;
  purpose: string;
}

export interface NetworkInfo {
  interface: string;
  ipAddress: string;
  macAddress?: string;
  speedGbps: number;
  rxKbps: number;
  txKbps: number;
  latencyToControllerMs: number;
  droppedPackets: number;
  packetErrors?: number;
}

export interface NodeProfile {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  kernel: string;
  architecture?: string;
  agentVersion?: string;
  status: NodeStatus;
  uptimeHours: number;
  lastHeartbeatTime: string;
  lastHeartbeatTimestampMs: number;
  heartbeatSeq: number;
  isLocalHost?: boolean;
  labels?: Record<string, string>;
  cpu: CpuInfo;
  ram: RamInfo;
  disks: DiskMount[];
  network: NetworkInfo;
  gpus: GpuInfo[];
  activeJobs: Array<{
    id: string;
    name: string;
    user: string;
    framework: string;
    gpuIndices: number[];
    vramAllocatedMb: number;
    uptimeSeconds: number;
    status: 'RUNNING' | 'STAGING' | 'COMPLETED' | 'FAILED';
  }>;
}

export interface ClusterKpis {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  staleNodes: number;
  totalGpus: number;
  availableGpus: number;
  gpusInUse: number;
  clusterGpuUtilization: number;
  totalVramTotalMb: number;
  totalVramUsedMb: number;
  clusterPowerWatts: number;
  clusterPowerLimitWatts: number;
  activeJobsCount: number;
  activeAlertsCount: number;
  hasGpuHardware: boolean;
}

export interface AlertRecord {
  id: string;
  timestamp: string;
  timestampMs: number;
  nodeId: string;
  nodeHostname: string;
  gpuIndex?: number;
  metric: string;
  currentValue: string | number;
  threshold: string | number;
  severity: AlertSeverity;
  status: AlertStatus;
  description: string;
  firstDetected: string;
  lastDetected: string;
}

export interface TimeSeriesPoint {
  timestampMs: number;
  timeStr: string;
  gpuUtil: number;
  vramUsedMb: number;
  vramPercent: number;
  tempC: number;
  powerW: number;
  clockCoreMhz: number;
  cpuUtil: number;
  ramUsedGb: number;
  netRxKbps: number;
  netTxKbps: number;
}

export interface SystemHealthInfo {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  uptimeSeconds: number;
  backendCpuUtil: number;
  backendMemRssMb: number;
  backendMemHeapUsedMb: number;
  ingestionRatePerMin: number;
  activeSseClients: number;
  totalRegisteredNodes: number;
  totalMonitoredGpus: number;
  databaseStatus: 'OPERATIONAL' | 'DEGRADED' | 'DISCONNECTED';
  lastIngestionTimestamp: string;
}

export interface HeartbeatPayload {
  nodeId: string;
  hostname: string;
  ip?: string;
  os?: string;
  kernel?: string;
  architecture?: string;
  agentVersion?: string;
  status?: NodeStatus;
  uptimeSeconds?: number;
  timestamp?: string;
  sequence?: number;
  cpu?: CpuInfo;
  ram?: RamInfo;
  disks?: DiskMount[];
  network?: NetworkInfo;
  gpus?: GpuInfo[];
  activeJobs?: any[];
}
