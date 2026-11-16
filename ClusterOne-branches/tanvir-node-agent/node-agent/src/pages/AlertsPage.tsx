import React, { useState } from 'react';
import { AlertRecord, AlertSeverity, AlertStatus } from '../types';
import { acknowledgeAlert } from '../services/api';
import { 
  BellRing, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Check, 
  Filter, 
  Flame 
} from 'lucide-react';

interface AlertsPageProps {
  alerts: AlertRecord[];
  onRefreshAlerts?: () => void;
  onSelectNode?: (nodeId: string) => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  alerts,
  onRefreshAlerts,
  onSelectNode,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AlertSeverity>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AlertStatus>('ALL');
  const [ackingId, setAckingId] = useState<string | null>(null);

  const handleAck = async (alertId: string) => {
    setAckingId(alertId);
    try {
      await acknowledgeAlert(alertId);
      if (onRefreshAlerts) onRefreshAlerts();
    } finally {
      setAckingId(null);
    }
  };

  const filtered = alerts.filter(a => {
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    return true;
  });

  const activeCount = alerts.filter(a => a.status === 'ACTIVE').length;
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'ACTIVE').length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/90 p-4 rounded-2xl border border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 font-mono">
              <BellRing className="w-5 h-5 text-rose-400" />
              Automated Alert Sentinel ({alerts.length})
            </h2>
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600 text-white animate-pulse">
                {criticalCount} CRITICAL
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-zinc-400 mt-0.5">
            Continuously evaluates thermal ceiling, VRAM allocation, node heartbeats, and throttling state
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="WARNING">Warning Only</option>
            <option value="INFO">Info Only</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All States</option>
            <option value="ACTIVE">Active Only ({activeCount})</option>
            <option value="ACKNOWLEDGED">Acknowledged Only</option>
          </select>
        </div>
      </div>

      {/* Alerts Feed */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-950/90 rounded-2xl border border-dashed border-zinc-800 p-12 text-center space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <div className="text-sm font-bold text-zinc-300 font-mono">
            No active threshold alerts.
          </div>
          <p className="text-xs text-zinc-500 font-mono max-w-md mx-auto">
            All cluster nodes, accelerators, temperatures, and memory limits are running within normal nominal parameters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isWarning = alert.severity === 'WARNING';
            const isAcked = alert.status === 'ACKNOWLEDGED';

            return (
              <div
                key={alert.id}
                className={`rounded-2xl p-4 border transition-all duration-200 ${
                  isAcked
                    ? 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400'
                    : isCritical
                      ? 'bg-rose-950/50 border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                      : 'bg-zinc-950/90 border-amber-500/50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      isAcked 
                        ? 'bg-zinc-800 text-zinc-400'
                        : isCritical
                          ? 'bg-rose-500 text-white animate-bounce'
                          : 'bg-amber-500 text-zinc-950'
                    }`}>
                      {isCritical ? <Flame className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    </div>

                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                          isCritical ? 'bg-rose-600 text-white' : 'bg-amber-500 text-zinc-950'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="font-bold text-white text-sm">
                          {alert.nodeHostname} {alert.gpuIndex !== undefined ? `· GPU #${alert.gpuIndex}` : ''}
                        </span>
                        <span className="text-zinc-500">({alert.metric})</span>
                        {isAcked && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-400">
                            ACKNOWLEDGED
                          </span>
                        )}
                      </div>

                      <p className={`text-xs ${isAcked ? 'text-zinc-400' : 'text-zinc-200'}`}>
                        {alert.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 pt-0.5">
                        <span>Current: <strong className="text-zinc-300">{alert.currentValue}</strong></span>
                        <span>Threshold: <strong className="text-zinc-300">{alert.threshold}</strong></span>
                        <span>First: {alert.firstDetected.split('T')[1]?.slice(0, 8)}</span>
                        <span>Last: {alert.lastDetected.split('T')[1]?.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {!isAcked && (
                    <div className="shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleAck(alert.id)}
                        disabled={ackingId === alert.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Acknowledge</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
