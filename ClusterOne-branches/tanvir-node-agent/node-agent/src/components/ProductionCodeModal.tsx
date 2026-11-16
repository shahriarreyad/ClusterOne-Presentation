import React, { useState } from 'react';
import { X, Copy, Check, Code, Download, FileText, Settings, Terminal } from 'lucide-react';
import { 
  PYTHON_AGENT_CODE, 
  SYSTEMD_SERVICE_CODE, 
  INSTALL_SCRIPT_CODE 
} from '../data/agentSourceCode';

interface ProductionCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductionCodeModal: React.FC<ProductionCodeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'python' | 'systemd' | 'installer'>('python');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const getActiveCode = () => {
    switch (activeTab) {
      case 'python': return { filename: 'clusterone_agent.py', code: PYTHON_AGENT_CODE };
      case 'systemd': return { filename: 'clusterone-agent.service', code: SYSTEMD_SERVICE_CODE };
      case 'installer': return { filename: 'install.sh', code: INSTALL_SCRIPT_CODE };
    }
  };

  const { filename, code } = getActiveCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-5xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Compute Node Agent — Production Deployment Package</h3>
              <p className="text-xs text-zinc-400 font-mono">
                System packages for compute nodes &bull; Repository component: <span className="text-emerald-400 font-bold">agent/</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="bg-zinc-950/90 px-4 py-2 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'python'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              clusterone_agent.py
            </button>

            <button
              onClick={() => setActiveTab('systemd')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'systemd'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              clusterone-agent.service
            </button>

            <button
              onClick={() => setActiveTab('installer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'installer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              install.sh
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {filename}</span>
            </button>
          </div>
        </div>

        {/* Code Content Container */}
        <div className="p-4 overflow-y-auto flex-1 bg-zinc-950 font-mono text-xs text-zinc-300">
          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800/90 overflow-x-auto">
            <pre className="text-zinc-200 leading-relaxed">{code}</pre>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>Target Architecture: Linux x86_64 / NVIDIA CUDA 12.x / Python 3.10+</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
