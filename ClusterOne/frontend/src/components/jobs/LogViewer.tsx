import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Download,
  ArrowDownToLine,
  Pause,
  Play,
  Trash2,
  Maximize2,
  Minimize2,
  Copy,
  Check,
} from 'lucide-react'
import type { LogLine } from '@/types/job'
import { cn } from '@/lib/format'

const LEVEL_CLASS: Record<LogLine['level'], string> = {
  INFO: 'text-text-secondary',
  WARN: 'text-status-queued',
  ERROR: 'text-status-failed',
}

interface LogViewerProps {
  logs: LogLine[]
  jobId: string
  live?: boolean
}

export function LogViewer({ logs, jobId, live }: LogViewerProps) {
  const [query, setQuery] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Hold captured logs when paused
  const [frozenLogs, setFrozenLogs] = useState<LogLine[]>(logs)

  useEffect(() => {
    if (!isPaused) {
      setFrozenLogs(logs)
    }
  }, [logs, isPaused])

  const effectiveLogs = cleared ? [] : (isPaused ? frozenLogs : logs)

  const filtered = useMemo(() => {
    if (!query.trim()) return effectiveLogs
    const q = query.toLowerCase()
    return effectiveLogs.filter((l) => l.message.toLowerCase().includes(q))
  }, [effectiveLogs, query])

  useEffect(() => {
    if (autoScroll && !isPaused) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [filtered, autoScroll, isPaused])

  const handleDownload = () => {
    const text = effectiveLogs.map((l) => `[${l.timestamp}] ${l.level.padEnd(5)} ${l.message}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-${jobId}-logs.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = () => {
    const text = effectiveLogs.map((l) => `[${l.timestamp}] ${l.level.padEnd(5)} ${l.message}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-card)] border border-border bg-[#0B0F19] transition-all',
        isFullScreen && 'fixed inset-4 z-50 flex flex-col shadow-2xl border-accent/40',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/80 bg-surface/90 px-3 py-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logs or regex..."
            aria-label="Search logs"
            className="w-full rounded-md border border-border bg-bg-secondary py-1.5 pl-8 pr-2 text-[12.5px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {live && (
            <span className="flex items-center gap-1.5 rounded-full bg-status-running/15 px-2.5 py-1 text-[11px] font-semibold text-status-running border border-status-running/30">
              <span className="h-1.5 w-1.5 rounded-full bg-status-running animate-pulse-dot" />
              Live Stream
            </span>
          )}

          <button
            onClick={() => setIsPaused((p) => !p)}
            className={cn(
              'flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors',
              isPaused
                ? 'border-status-queued/40 bg-status-queued-soft text-status-queued'
                : 'border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            )}
            title={isPaused ? 'Resume live log stream' : 'Pause log stream'}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <label className="flex items-center gap-1.5 text-[12px] text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-accent"
            />
            Auto-scroll
          </label>

          <button
            onClick={() => setCleared((c) => !c)}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11.5px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            title={cleared ? 'Restore logs' : 'Clear current buffer'}
          >
            <Trash2 size={12} />
            <span>{cleared ? 'Restore' : 'Clear'}</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11.5px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            title="Copy logs to clipboard"
          >
            {copied ? <Check size={12} className="text-status-running" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11.5px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            title="Download full log file"
          >
            <Download size={12} />
            <span>Download</span>
          </button>

          <button
            onClick={() => setIsFullScreen((f) => !f)}
            className="flex items-center gap-1 rounded-md border border-border p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            title={isFullScreen ? 'Exit fullscreen' : 'Expand full screen'}
          >
            {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'scrollbar-thin overflow-y-auto bg-[#070A11] p-3.5 font-mono text-[12px] leading-relaxed text-text-secondary',
          isFullScreen ? 'flex-1 max-h-none' : 'max-h-[500px]',
        )}
      >
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-text-muted">
            {cleared ? 'Log view cleared. Click "Restore" to view logs again.' : 'No log lines match your search.'}
          </div>
        ) : (
          filtered.map((line) => (
            <div key={line.id} className={cn('flex gap-2 py-0.5 hover:bg-white/[0.02]', LEVEL_CLASS[line.level])}>
              <span className="shrink-0 text-text-muted select-none">
                [{line.timestamp ? new Date(line.timestamp).toLocaleTimeString() : '00:00:00'}]
              </span>
              <span className={cn('shrink-0 font-semibold select-none', LEVEL_CLASS[line.level])}>
                {line.level.padEnd(5)}
              </span>
              <span className="break-all whitespace-pre-wrap">{line.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true)
            bottomRef.current?.scrollIntoView({ block: 'end' })
          }}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border bg-surface py-1.5 text-[11.5px] text-text-muted hover:text-text-primary"
        >
          <ArrowDownToLine size={12} />
          Jump to latest
        </button>
      )}
    </div>
  )
}
