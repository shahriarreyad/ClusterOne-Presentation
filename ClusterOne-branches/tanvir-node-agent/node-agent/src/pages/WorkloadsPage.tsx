import React, { useState, useEffect, useMemo } from 'react';
import { fetchWorkloads } from '../services/api';
import { 
  Terminal, 
  Search, 
  Filter, 
  RotateCcw, 
  Cpu, 
  Zap, 
  User, 
  Layers 
} from 'lucide-react';

interface WorkloadsPageProps {
  onSelectNode?: (nodeId: string) => void;
}

export const WorkloadsPage: React.FC<WorkloadsPageProps> = ({ onSelectNode }) => {
  const [workloads, setWorkloads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchWorkloads();
      setWorkloads(data || []);
    } catch {
      setWorkloads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return workloads;
    const q = searchQuery.toLowerCase();
    return workloads.filter(w => 
      (w.processName && w.processName.toLowerCase().includes(q)) ||
      (w.user && w.user.toLowerCase().includes(q)) ||
      (w.nodeHostname && w.nodeHostname.toLowerCase().includes(q)) ||
      String(w.pid).includes(q)
    );
  }, [workloads, searchQuery]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/90 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-400" />
            Active GPU Workloads & Process Tree ({workloads.length})
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-0.5">
            Real-time attribution: observe which user and process is consuming VRAM across nodes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter user, PID, command..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 w-48 sm:w-56"
            />
          </div>

          <button
            onClick={loadData}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
            title="Refresh process list"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Process Table */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-950/90 rounded-2xl border border-dashed border-zinc-800 p-12 text-center space-y-3">
          <Terminal className="w-8 h-8 text-zinc-600 mx-auto" />
          <div className="text-sm font-bold text-zinc-300 font-mono">No active GPU compute processes detected.</div>
          <p className="text-xs text-zinc-500 font-mono max-w-md mx-auto">
            All attached accelerators are currently in an idle state. When a PyTorch, TensorFlow, or vLLM job launches, its PID and VRAM footprint will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-950/90 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                  <th className="p-3 font-medium">PID</th>
                  <th className="p-3 font-medium">User</th>
                  <th className="p-3 font-medium">Host Node</th>
                  <th className="p-3 font-medium">GPU Device</th>
                  <th className="p-3 font-medium">Process Command</th>
                  <th className="p-3 font-medium text-right">VRAM Footprint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filtered.map((proc, idx) => (
                  <tr key={`${proc.nodeId}-${proc.pid}-${idx}`} className="hover:bg-zinc-900/50">
                    <td className="p-3 font-bold text-emerald-400">#{proc.pid}</td>
                    <td className="p-3 text-zinc-300">{proc.user || 'root'}</td>
                    <td className="p-3 text-zinc-300 font-medium">{proc.nodeHostname || proc.nodeId}</td>
                    <td className="p-3 text-purple-400 font-bold">
                      GPU #{proc.gpuIndex} ({proc.gpuName?.split(' ')[1] || 'GPU'})
                    </td>
                    <td className="p-3 text-zinc-200 truncate max-w-sm" title={proc.processName}>
                      {proc.processName}
                    </td>
                    <td className="p-3 text-right font-bold text-purple-400">
                      {proc.usedMemoryMb} MB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
