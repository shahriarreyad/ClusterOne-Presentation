// -----------------------------------------------------------------------
// Thin HTTP client used by the service layer (see jobService.ts).
//
// INTEGRATION POINT: this is the one place that knows how to reach the
// real ClusterOne API. Today `USE_MOCK` is true and every service function
// resolves against in-memory mock data (src/data/mockData.ts) instead of
// calling `request()`. To connect a real backend:
//
//   1. Set VITE_CLUSTERONE_API_URL in your environment (.env).
//   2. Flip USE_MOCK to false (or drive it from import.meta.env.MODE).
//   3. Each function in jobService.ts already has the matching
//      `request<T>(...)` call written but commented out/unused — wire it
//      in and delete the mock branch.
//
// No component in src/pages or src/components talks to `fetch` directly;
// they only ever import from the service layer, so this swap never touches
// UI code.
// -----------------------------------------------------------------------

export const API_BASE_URL = import.meta.env.VITE_CLUSTERONE_API_URL ?? '/api'

export const USE_MOCK = true

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new ApiError(`Request to ${path} failed with status ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

/** Simulates realistic network latency for the mock service layer. */
export function mockDelay(min = 250, max = 650): Promise<void> {
  const ms = min + Math.random() * (max - min)
  return new Promise((resolve) => setTimeout(resolve, ms))
}
