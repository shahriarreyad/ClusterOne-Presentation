import React from 'react';
import { 
  Layers, 
  Server, 
  Terminal, 
  BellRing, 
  Network, 
  ShieldCheck, 
  Activity, 
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search
} from 'lucide-react';

export type NavigationPage = 
  | 'dashboard'
  | 'nodes'
  | 'node-detail'
  | 'gpu-detail'
  | 'workloads'
  | 'alerts'
  | 'topology'
  | 'cluster-health'
  | 'system-health';

interface TopNavBarProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  streamStatus: 'CONNECTED' | 'RECONNECTING' | 'ERROR';
  lastTelemetryTimestampMs: number;
  activeAlertsCount: number;
  onOpenAgentModal: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  currentPage,
  onNavigate,
  streamStatus,
  lastTelemetryTimestampMs,
  activeAlertsCount,
  onOpenAgentModal,
  searchQuery,
  onSearchChange,
}) => {
  const [secondsAgo, setSecondsAgo] = React.useState<number>(0);

  // Update relative timestamp ticker every second
  React.useEffect(() => {
    const updateTicker = () => {
      if (!lastTelemetryTimestampMs) return;
      const diffSec = Math.max(0, Math.round((Date.now() - lastTelemetryTimestampMs) / 1000));
      setSecondsAgo(diffSec);
    };
    updateTicker();
    const timer = setInterval(updateTicker, 1000);
    return () => clearInterval(timer);
  }, [lastTelemetryTimestampMs]);

  const isStale = secondsAgo > 15;

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-2.5 w-full">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Brand Identity & Live Stream Signal */}
        <div className="flex items-center gap-4">
          <div 
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white tracking-tight text-sm sm:text-base">ClusterOne</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 uppercase tracking-widest">
                  Observability
                </span>
              </div>
              <div className="text-[10px] font-mono text-zinc-500">
                GPU Infrastructure & Node Telemetry
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

          {/* Real Live Transport Indicator */}
          <div className="flex items-center gap-2 font-mono text-xs">
            {streamStatus === 'CONNECTED' ? (
              isStale ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-500/30 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="font-bold uppercase tracking-wider text-[11px]">STALE</span>
                  <span className="text-[10px] text-zinc-400">({secondsAgo}s ago)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/30 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold uppercase tracking-wider text-[11px]">LIVE</span>
                  <span className="text-[10px] text-zinc-400 hidden sm:inline">&bull; {secondsAgo}s ago</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-950/50 border border-rose-500/40 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="font-bold uppercase tracking-wider text-[11px]">
                  {streamStatus === 'RECONNECTING' ? 'RECONNECTING...' : 'DISCONNECTED'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Center/Right: Primary View Navigation Bar */}
        <nav className="flex flex-wrap items-center gap-1 text-xs font-mono">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPage === 'dashboard'
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => onNavigate('nodes')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPage === 'nodes' || currentPage === 'node-detail' || currentPage === 'gpu-detail'
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-blue-400" />
            <span>Nodes</span>
          </button>

          <button
            onClick={() => onNavigate('workloads')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPage === 'workloads'
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Workloads</span>
          </button>

          <button
            onClick={() => onNavigate('alerts')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 relative ${
              currentPage === 'alerts'
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BellRing className="w-3.5 h-3.5 text-rose-400" />
            <span>Alerts</span>
            {activeAlertsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                {activeAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('topology')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPage === 'topology'
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-purple-400" />
            <span>Topology</span>
          </button>

          <button
            onClick={() => onNavigate('cluster-health')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPage === 'cluster-health'
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Health</span>
          </button>

          <button
            onClick={() => onNavigate('system-health')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPage === 'system-health'
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Platform</span>
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1 hidden sm:block" />

          {/* Install Agent Runbook Trigger */}
          <button
            onClick={onOpenAgentModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
            title="Deploy Node Agent on real GPU server"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Connect Node</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
