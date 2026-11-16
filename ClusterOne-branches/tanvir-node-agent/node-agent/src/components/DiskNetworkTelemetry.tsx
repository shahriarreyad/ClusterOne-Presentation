import React from 'react';
import { HardDrive, Network, ArrowDown, ArrowUp, ShieldCheck, Lock, Activity } from 'lucide-react';
import { DiskMount, NetworkInfo } from '../types';

interface DiskNetworkTelemetryProps {
  disks: DiskMount[];
  network: NetworkInfo;
}

export const DiskNetworkTelemetry: React.FC<DiskNetworkTelemetryProps> = ({ disks, network }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Disk Mounts & I/O */}
      <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Storage & Mount Points</h3>
                <p className="text-xs text-zinc-400 font-mono">Local NVMe Scratch & Shared NFS</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
              {disks.length} Mounts
            </span>
          </div>

          <div className="space-y-3 my-4">
            {disks.map((d) => {
              const usedPercent = (d.usedGb / d.totalGb) * 100;
              const isScratch = d.path === '/scratch';

              return (
                <div 
                  key={d.path}
                  className={`p-3 rounded-xl border transition-all ${
                    isScratch 
                      ? 'bg-amber-950/20 border-amber-800/50' 
                      : 'bg-zinc-950/70 border-zinc-800/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white">{d.path}</span>
                      {d.isReadOnly && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-800 text-zinc-300 flex items-center gap-1 border border-zinc-700">
                          <Lock className="w-2.5 h-2.5" /> RO
                        </span>
                      )}
                      {isScratch && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                          AI Cache
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-zinc-300">
                      {d.usedGb.toFixed(0)} / {d.totalGb.toFixed(0)} GB ({usedPercent.toFixed(0)}%)
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full rounded-full ${
                        isScratch ? 'bg-amber-400' : usedPercent > 80 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(2, usedPercent)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span className="truncate max-w-[200px]" title={d.device}>{d.device} ({d.fstype})</span>
                    <span className="text-zinc-400 flex items-center gap-2">
                      <span>R: {d.readThroughputMBs.toFixed(1)} MB/s</span>
                      <span>W: {d.writeThroughputMBs.toFixed(1)} MB/s</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
          <span>Collector: psutil.disk_partitions()</span>
          <span>Scratch I/O Policy: DirectNVMe</span>
        </div>
      </div>

      {/* Network Interface & Link Telemetry */}
      <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Network & Interconnect</h3>
                <p className="text-xs text-zinc-400 font-mono">Cluster High-Speed Fabric</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-xs font-mono font-bold text-teal-400">
              {network.speedGbps} Gbps Link
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 my-4">
            <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/60">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Interface</span>
              <div className="text-sm font-bold text-white font-mono mt-1">
                {network.interface}
              </div>
              <span className="text-[10px] text-zinc-500 font-mono truncate block" title={network.macAddress}>
                MAC: {network.macAddress}
              </span>
            </div>

            <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/60">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Controller Latency</span>
              <div className="text-sm font-bold text-emerald-400 font-mono mt-1">
                {network.latencyToControllerMs.toFixed(2)} ms
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Zero packet loss</span>
            </div>
          </div>

          {/* Traffic Rates */}
          <div className="space-y-2.5 bg-zinc-950/70 p-3.5 rounded-xl border border-zinc-800/70">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                RX Inbound Bandwidth
              </span>
              <span className="font-bold text-emerald-400">
                {(network.rxKbps / 1024).toFixed(2)} MB/s
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, Math.max(2, (network.rxKbps / 1024) * 2))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono pt-2">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                TX Outbound Bandwidth
              </span>
              <span className="font-bold text-blue-400">
                {(network.txKbps / 1024).toFixed(2)} MB/s
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.min(100, Math.max(2, (network.txKbps / 1024) * 2))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
          <span>Collector: psutil.net_io_counters()</span>
          <span>Drops: {network.droppedPackets} pkts</span>
        </div>
      </div>
    </div>
  );
};
