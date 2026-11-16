import React from 'react';
import { Play, Square, AlertCircle, Box, User, Clock, Terminal, CheckCircle2 } from 'lucide-react';
import { ActiveJob } from '../types';

interface ActiveJobPanelProps {
  activeJobs: ActiveJob[];
  onCancelJob: (jobId: string) => void;
  onDispatchNewJob: () => void;
}

export const ActiveJobPanel: React.FC<ActiveJobPanelProps> = ({
  activeJobs,
  onCancelJob,
  onDispatchNewJob,
}) => {
  return (
    <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800/80 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Agent Task Supervisor & Container Runner</h3>
            <p className="text-xs text-zinc-400 font-mono">Apptainer (Singularity) & Slurm Step Execution</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">
            Active: <span className="text-emerald-400 font-bold">{activeJobs.length}</span> job(s)
          </span>
          <button
            id="btn-dispatch-subtask"
            onClick={onDispatchNewJob}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
          >
            + Dispatch Job
          </button>
        </div>
      </div>

      {activeJobs.length === 0 ? (
        <div className="py-8 text-center bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800 my-4">
          <Box className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-xs font-mono text-zinc-400">No active jobs assigned to this compute node</p>
          <p className="text-[11px] text-zinc-500 font-mono mt-1">
            The node is reported as <span className="text-emerald-400">IDLE</span> to the central cluster scheduler.
          </p>
        </div>
      ) : (
        <div className="space-y-4 my-4">
          {activeJobs.map((job) => (
            <div 
              key={job.jobId}
              className="bg-zinc-950/80 rounded-xl border border-zinc-800/90 p-4 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/60">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                    {job.jobId}
                  </span>
                  <h4 className="text-sm font-bold text-white font-mono break-all">{job.jobName}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold animate-pulse">
                    RUNNING
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id={`btn-cancel-job-${job.jobId}`}
                    onClick={() => onCancelJob(job.jobId)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                    title="Send SIGTERM to container process"
                  >
                    <Square className="w-3 h-3" />
                    <span>SIGTERM</span>
                  </button>
                </div>
              </div>

              {/* Job Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 text-xs font-mono">
                <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 block">Submitted By</span>
                  <span className="text-zinc-300 font-medium flex items-center gap-1 mt-0.5 truncate">
                    <User className="w-3 h-3 text-zinc-400 shrink-0" /> {job.user}
                  </span>
                </div>

                <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 block">Container SIF</span>
                  <span className="text-emerald-400 font-medium truncate block mt-0.5" title={job.container}>
                    {job.container}
                  </span>
                </div>

                <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 block">VRAM Consumed</span>
                  <span className="text-purple-400 font-medium mt-0.5 block truncate">
                    {(job.vramAllocatedMb / 1024).toFixed(1)} GB
                  </span>
                </div>

                <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 block">Process PID</span>
                  <span className="text-zinc-300 font-medium mt-0.5 block truncate">
                    PID #{job.pid} ({job.cpuCoresUsed}c)
                  </span>
                </div>
              </div>

              {/* Stdout tail */}
              <div className="bg-black/90 p-2.5 rounded-lg border border-zinc-800/80 font-mono text-[11px] text-zinc-300 space-y-1 overflow-x-auto max-w-full">
                <div className="text-zinc-500 text-[10px] pb-1 border-b border-zinc-900 flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-emerald-400 shrink-0" />
                  Process Output Stream (apptainer run --nv)
                </div>
                {job.outputLogTail.map((line, i) => (
                  <div key={i} className="text-zinc-400 break-all">
                    <span className="text-zinc-600 mr-2">&gt;</span>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
