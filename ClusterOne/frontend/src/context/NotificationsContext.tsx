import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { NotificationItem } from '@/types/job'
import { MOCK_NOTIFICATIONS } from '@/data/mockData'

interface NotificationsContextValue {
  notifications: NotificationItem[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS)

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }
  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const value = { notifications, unreadCount, markAsRead, markAllAsRead }
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
