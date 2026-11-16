import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/format'

interface PaginationProps {
  page: number
  totalPages: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function Pagination({ page, totalPages, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
      <div className="flex items-center gap-2 text-[12.5px] text-text-secondary">
        <span>
          {start}–{end} of {total}
        </span>
        <span className="mx-1 hidden text-border sm:inline">|</span>
        <label className="hidden items-center gap-1.5 sm:flex">
          Rows:
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] text-text-primary focus:border-accent focus:outline-none"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="tabular px-2 text-[12.5px] text-text-secondary">
          Page {page} of {totalPages}
        </span>
        <button
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
