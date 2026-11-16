import { useEffect, useRef } from 'react'

/**
 * Calls `callback` on an interval while `enabled` is true.
 *
 * This is the one seam that would change if the real ClusterOne backend
 * exposes a WebSocket/SSE stream for job status, metrics and logs instead
 * of a pollable REST endpoint (see project plan sections 47–48): swap the
 * `setInterval` body for a subscription and everything above this hook
 * (pages, other hooks) is unaffected.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled = true): void {
  const savedCallback = useRef(callback)
  savedCallback.current = callback

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => savedCallback.current(), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, enabled])
}
