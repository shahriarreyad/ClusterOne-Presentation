import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { UserProfile } from '@/data/mockData'
import { CURRENT_USER } from '@/data/mockData'

const STORAGE_KEY = 'clusterone:profile:v2'

interface UserContextValue {
  profile: UserProfile
  updateProfile: (patch: Partial<Pick<UserProfile, 'name' | 'phone' | 'location' | 'bio'>>) => void
  setAvatar: (dataUrl: string | null) => void
}

const UserContext = createContext<UserContextValue | null>(null)

function loadInitialProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return CURRENT_USER
    const saved = JSON.parse(raw) as Partial<UserProfile>
    return { ...CURRENT_USER, ...saved }
  } catch {
    return CURRENT_USER
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(loadInitialProfile)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    } catch {
      // Storage may be unavailable (private browsing, quota exceeded, etc.) — edits still
      // work for the session, they just won't survive a page reload.
    }
  }, [profile])

  const updateProfile: UserContextValue['updateProfile'] = (patch) => {
    setProfile((prev) => ({ ...prev, ...patch }))
  }

  const setAvatar = (dataUrl: string | null) => {
    setProfile((prev) => ({ ...prev, avatarUrl: dataUrl }))
  }

  return <UserContext.Provider value={{ profile, updateProfile, setAvatar }}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
