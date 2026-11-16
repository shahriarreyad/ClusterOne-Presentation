import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Copy, Trash2, Pause, Play, Check, Filter } from 'lucide-react';
import { AgentLogMessage } from '../types';

interface LiveLogsTerminalProps {
  logs: AgentLogMessage[];
  onClearLogs: () => void;
}

export const LiveLogsTerminal: React.FC<LiveLogsTerminalProps> = ({ logs, onClearLogs }) => {
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter(log => {
    if (filterLevel === 'ALL') return true;
    return log.level === filterLevel;
  });

  // Only scroll the internal log container, never scrolling the browser window
  useEffect(() => {
    if (!isPaused && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  const handleCopyLogs = () => {
    const text = filteredLogs.map(l => `${l.timestamp} [${l.level}] [${l.category}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-rose-400 font-bold';
      case 'WARN': return 'text-amber-400 font-medium';
      case 'HEARTBEAT': return 'text-emerald-400';
      case 'DEBUG': return 'text-zinc-500';
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden font-mono">
      {/* Terminal Titlebar */}
      <div className="bg-zinc-900/90 px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-zinc-200">/var/log/clusterone-agent.log</span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">&bull; PID #1209 (clusterone-agent.service)</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800 text-xs">
            <Filter className="w-3 h-3 text-zinc-400" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-transparent text-zinc-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Levels</option>
              <option value="HEARTBEAT">Heartbeat Only</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warnings</option>
              <option value="ERROR">Errors</option>
            </select>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`p-1.5 rounded-md border text-xs transition-colors ${
              isPaused 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
            title={isPaused ? "Resume log stream" : "Pause auto-scroll"}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors"
            title="Copy logs to clipboard"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            onClick={onClearLogs}
            className="p-1.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Log Entries Container */}
      <div 
        ref={scrollContainerRef}
        className="p-4 h-64 overflow-y-auto text-xs space-y-1 bg-zinc-950 text-zinc-300 select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-zinc-600 italic text-center py-10">No log entries matching filter.</div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="leading-relaxed hover:bg-zinc-900/50 px-1 rounded flex items-start gap-2">
              <span className="text-zinc-600 select-none text-[11px] whitespace-nowrap">{log.timestamp}</span>
              <span className={`text-[11px] whitespace-nowrap ${getLevelColor(log.level)}`}>
                [{log.level.padEnd(9, ' ')}]
              </span>
              <span className="text-zinc-500 text-[11px] whitespace-nowrap">[{log.category}]</span>
              <span className="text-zinc-300 break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
