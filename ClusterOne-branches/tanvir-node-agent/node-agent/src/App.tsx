/**
 * ClusterOne GPU Cluster Observability Platform
 * Developer: Md. Tanvir Hasan
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  NodeProfile, 
  ClusterKpis, 
  AlertRecord 
} from './types';
import { connectTelemetryStream, fetchClusterKpis, fetchRegisteredNodes, fetchAlerts } from './services/api';
import { TopNavBar, NavigationPage } from './components/TopNavBar';
import { ClusterOverviewPage } from './pages/ClusterOverviewPage';
import { NodesPage } from './pages/NodesPage';
import { NodeDetailPage } from './pages/NodeDetailPage';
import { GpuDetailPage } from './pages/GpuDetailPage';
import { WorkloadsPage } from './pages/WorkloadsPage';
import { AlertsPage } from './pages/AlertsPage';
import { TopologyPage } from './pages/TopologyPage';
import { ClusterHealthPage } from './pages/ClusterHealthPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { AgentSetupModal } from './components/AgentSetupModal';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<NavigationPage>('dashboard');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedGpuIndex, setSelectedGpuIndex] = useState<number | null>(null);

  const [nodes, setNodes] = useState<NodeProfile[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [streamStatus, setStreamStatus] = useState<'CONNECTED' | 'RECONNECTING' | 'ERROR'>('RECONNECTING');
  const [lastTelemetryTimestampMs, setLastTelemetryTimestampMs] = useState<number>(Date.now());
  const [isAgentModalOpen, setIsAgentModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Initial HTTP Fetch to guarantee data loads immediately
  useEffect(() => {
    let mounted = true;
    async function initFetch() {
      try {
        const [registered, initialAlerts] = await Promise.all([
          fetchRegisteredNodes().catch(() => []),
          fetchAlerts().catch(() => []),
        ]);
        if (mounted) {
          if (registered.length > 0) setNodes(registered);
          setAlerts(initialAlerts);
          setLastTelemetryTimestampMs(Date.now());
        }
      } catch (err) {
        console.error('Initial fetch failed:', err);
      }
    }
    initFetch();

    // Connect Real-Time Server-Sent Events (SSE) Stream
    const disconnectStream = connectTelemetryStream(
      (data) => {
        if (!mounted) return;
        if (data.nodes && Array.isArray(data.nodes)) {
          setNodes(data.nodes);
        }
        if (data.alerts && Array.isArray(data.alerts)) {
          setAlerts(data.alerts);
        }
        setLastTelemetryTimestampMs(Date.now());
      },
      (status) => {
        if (mounted) setStreamStatus(status);
      }
    );

    return () => {
      mounted = false;
      disconnectStream();
    };
  }, []);

  // Compute Cluster KPIs from currently connected real nodes
  const kpis: ClusterKpis = useMemo(() => {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(n => n.status === 'ONLINE' || n.status === 'BUSY').length;
    const offlineNodes = nodes.filter(n => n.status === 'OFFLINE').length;
    const staleNodes = nodes.filter(n => n.status === 'STALE').length;

    let totalGpus = 0;
    let totalVramTotalMb = 0;
    let totalVramUsedMb = 0;
    let clusterPowerWatts = 0;
    let clusterPowerLimitWatts = 0;
    let sumGpuUtil = 0;
    let gpusInUse = 0;
    let activeJobsCount = 0;

    nodes.forEach(n => {
      if (n.gpus && Array.isArray(n.gpus)) {
        totalGpus += n.gpus.length;
        n.gpus.forEach(g => {
          totalVramTotalMb += g.vramTotalMb || 0;
          totalVramUsedMb += g.vramUsedMb || 0;
          clusterPowerWatts += g.powerDrawWatts || 0;
          clusterPowerLimitWatts += g.powerLimitWatts || 0;
          sumGpuUtil += g.utilizationGpu || 0;
          if ((g.utilizationGpu || 0) > 5) gpusInUse++;
        });
      }
      if (n.activeJobs) {
        activeJobsCount += n.activeJobs.length;
      }
    });

    const clusterGpuUtilization = totalGpus > 0 ? Math.round(sumGpuUtil / totalGpus) : 0;
    const availableGpus = totalGpus - gpusInUse;

    return {
      totalNodes,
      onlineNodes,
      offlineNodes,
      staleNodes,
      totalGpus,
      availableGpus,
      gpusInUse,
      clusterGpuUtilization,
      totalVramTotalMb,
      totalVramUsedMb,
      clusterPowerWatts: Math.round(clusterPowerWatts),
      clusterPowerLimitWatts: Math.round(clusterPowerLimitWatts),
      activeJobsCount,
      activeAlertsCount: alerts.filter(a => a.status === 'ACTIVE').length,
      hasGpuHardware: totalGpus > 0,
    };
  }, [nodes, alerts]);

  // Active Selected Node & GPU entities
  const activeNode = useMemo(() => {
    if (!selectedNodeId) return nodes[0] || null;
    return nodes.find(n => n.id === selectedNodeId) || nodes[0] || null;
  }, [nodes, selectedNodeId]);

  const activeGpu = useMemo(() => {
    if (!activeNode || !activeNode.gpus || activeNode.gpus.length === 0) return null;
    if (selectedGpuIndex === null) return activeNode.gpus[0];
    return activeNode.gpus.find(g => g.index === selectedGpuIndex) || activeNode.gpus[0];
  }, [activeNode, selectedGpuIndex]);

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedGpuIndex(null);
    setCurrentPage('node-detail');
  };

  const handleSelectGpu = (nodeId: string, gpuIndex: number) => {
    setSelectedNodeId(nodeId);
    setSelectedGpuIndex(gpuIndex);
    setCurrentPage('gpu-detail');
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Industrial Navigation Bar */}
      <TopNavBar
        currentPage={currentPage}
        onNavigate={(p) => setCurrentPage(p)}
        streamStatus={streamStatus}
        lastTelemetryTimestampMs={lastTelemetryTimestampMs}
        activeAlertsCount={kpis.activeAlertsCount}
        onOpenAgentModal={() => setIsAgentModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-5">
        {currentPage === 'dashboard' && (
          <ClusterOverviewPage
            nodes={nodes}
            kpis={kpis}
            alerts={alerts}
            onSelectNode={handleSelectNode}
            onSelectGpu={handleSelectGpu}
            onOpenAgentModal={() => setIsAgentModalOpen(true)}
            onNavigate={(p) => setCurrentPage(p)}
          />
        )}

        {currentPage === 'nodes' && (
          <NodesPage
            nodes={nodes}
            onSelectNode={handleSelectNode}
            onOpenAgentModal={() => setIsAgentModalOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {currentPage === 'node-detail' && activeNode && (
          <NodeDetailPage
            node={activeNode}
            onBack={() => setCurrentPage('nodes')}
            onSelectGpu={(gpuIdx) => handleSelectGpu(activeNode.id, gpuIdx)}
          />
        )}

        {currentPage === 'gpu-detail' && activeNode && activeGpu && (
          <GpuDetailPage
            node={activeNode}
            gpu={activeGpu}
            onBack={() => setCurrentPage('node-detail')}
          />
        )}

        {currentPage === 'workloads' && (
          <WorkloadsPage onSelectNode={handleSelectNode} />
        )}

        {currentPage === 'alerts' && (
          <AlertsPage
            alerts={alerts}
            onRefreshAlerts={async () => {
              const fresh = await fetchAlerts();
              setAlerts(fresh);
            }}
            onSelectNode={handleSelectNode}
          />
        )}

        {currentPage === 'topology' && (
          <TopologyPage
            nodes={nodes}
            onSelectNode={handleSelectNode}
            onSelectGpu={handleSelectGpu}
          />
        )}

        {currentPage === 'cluster-health' && (
          <ClusterHealthPage
            nodes={nodes}
            alerts={alerts}
          />
        )}

        {currentPage === 'system-health' && (
          <SystemHealthPage />
        )}
      </main>

      {/* Production Node Agent Setup Modal */}
      <AgentSetupModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        registeredNodesCount={nodes.length}
      />

      {/* Industrial Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 px-4 lg:px-8 py-4 text-xs font-mono text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>ClusterOne Infrastructure Observability v2.4.0-prod</span>
            <span>&bull;</span>
            <span>Live Hardware Telemetry Engine</span>
          </div>
          <div className="text-[11px] text-zinc-500">
            Source: Live NVML direct driver bindings &bull; Prometheus exporter enabled on /api/v1/metrics
          </div>
        </div>
      </footer>
    </div>
  );
};
export default App;
