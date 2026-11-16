// -----------------------------------------------------------------------
// Thin HTTP client used by the service layer.
// Connects directly to the real ClusterOne Core Cluster Engine API.
// -----------------------------------------------------------------------

export const API_BASE_URL = import.meta.env.VITE_CLUSTERONE_API_URL ?? '/api'

// Set to false for real backend operation.
export const USE_MOCK = false

export class ApiError extends Error {
  status?: number
  detail?: string
  constructor(message: string, status?: number, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('clusterone_auth_token')
}

/**
 * Username recorded on submitted jobs. With Keycloak enabled the backend ignores this and uses the
 * token's identity; in development it is the local part of the profile e-mail.
 */
export function currentUsername(): string {
  try {
    const raw = localStorage.getItem('clusterone:profile:v2')
    const email = raw ? (JSON.parse(raw) as { email?: string }).email : undefined
    const name = (email ?? '').split('@')[0].replace(/[^A-Za-z0-9_.-]/g, '')
    if (name) return name
  } catch {
    // storage unavailable: fall through
  }
  return 'anonymous'
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('clusterone_auth_token', token)
  } else {
    localStorage.removeItem('clusterone_auth_token')
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Ensure path starts with /v1 or / if API_BASE_URL already contains /api
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const targetUrl = `${API_BASE_URL}${cleanPath}`

  const res = await fetch(targetUrl, {
    ...init,
    headers,
  })

  if (!res.ok) {
    let detailMsg = `HTTP ${res.status}`
    try {
      const errJson = await res.json()
      if (errJson && errJson.detail) {
        detailMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail)
      }
    } catch {
      // not JSON
    }
    throw new ApiError(`Request to ${path} failed: ${detailMsg}`, res.status, detailMsg)
  }

  return res.json() as Promise<T>
}

/** Simulates network latency when mock data is explicitly enabled */
export function mockDelay(min = 150, max = 350): Promise<void> {
  const ms = min + Math.random() * (max - min)
  return new Promise((resolve) => setTimeout(resolve, ms))
}
