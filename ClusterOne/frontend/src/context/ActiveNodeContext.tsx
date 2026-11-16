import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

/** The compute node the user picked as "my GPU": jobs default to it, and the laptop CLI shares the idea. */
export interface ActiveNode {
  id: string
  hostname: string
}

interface ActiveNodeContextValue {
  activeNode: ActiveNode | null
  setActiveNode: (node: ActiveNode | null) => void
}

const STORAGE_KEY = 'clusterone:active-node'
const ActiveNodeContext = createContext<ActiveNodeContextValue | null>(null)

function load(): ActiveNode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<ActiveNode>
    return v.id && v.hostname ? { id: v.id, hostname: v.hostname } : null
  } catch {
    return null
  }
}

export function ActiveNodeProvider({ children }: { children: ReactNode }) {
  const [activeNode, setState] = useState<ActiveNode | null>(load)

  const setActiveNode = useCallback((node: ActiveNode | null) => {
    setState(node)
    try {
      if (node) localStorage.setItem(STORAGE_KEY, JSON.stringify(node))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // storage unavailable (private mode): the choice still works for this session
    }
  }, [])

  return <ActiveNodeContext.Provider value={{ activeNode, setActiveNode }}>{children}</ActiveNodeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveNode(): ActiveNodeContextValue {
  const ctx = useContext(ActiveNodeContext)
  if (!ctx) throw new Error('useActiveNode must be used inside <ActiveNodeProvider>')
  return ctx
}
