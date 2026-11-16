import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Download, ArrowDownToLine } from 'lucide-react'
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
  const bottomRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return logs
    const q = query.toLowerCase()
    return logs.filter((l) => l.message.toLowerCase().includes(q))
  }, [logs, query])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [filtered, autoScroll])

  const handleDownload = () => {
    const text = logs.map((l) => `[${l.timestamp}] ${l.level.padEnd(5)} ${l.message}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-${jobId}-logs.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2.5">
        <div className="relative min-w-[180px] flex-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logs..."
            aria-label="Search logs"
            className="w-full rounded-md border border-border bg-bg-secondary py-1.5 pl-8 pr-2 text-[12.5px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="accent-accent" />
          Auto-scroll
        </label>
        {live && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-status-running">
            <span className="h-1.5 w-1.5 rounded-full bg-status-running animate-pulse-dot" />
            Live
          </span>
        )}
        <button
          onClick={handleDownload}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <Download size={13} />
          Download Logs
        </button>
      </div>

      <div className="scrollbar-thin max-h-[480px] overflow-y-auto bg-bg-secondary p-3 font-mono text-[12px] leading-relaxed">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-text-muted">No log lines match your search.</p>
        ) : (
          filtered.map((line) => (
            <div key={line.id} className={cn('flex gap-2 py-0.5', LEVEL_CLASS[line.level])}>
              <span className="shrink-0 text-text-muted">[{new Date(line.timestamp).toLocaleTimeString()}]</span>
              <span className={cn('shrink-0 font-semibold', LEVEL_CLASS[line.level])}>{line.level}</span>
              <span className="break-all">{line.message}</span>
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
