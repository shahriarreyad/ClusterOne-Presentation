import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'

function titleForPath(pathname: string): string {
  if (pathname.startsWith('/dashboard')) return 'Job Management'
  if (pathname.startsWith('/jobs/new')) return 'Submit Job'
  if (pathname.startsWith('/jobs/history')) return 'Job History'
  if (/^\/jobs\/[^/]+/.test(pathname) && !pathname.startsWith('/jobs/running') && !pathname.startsWith('/jobs/queued') && !pathname.startsWith('/jobs/completed') && !pathname.startsWith('/jobs/failed') && !pathname.startsWith('/jobs/cancelled')) {
    return 'Job Details'
  }
  if (pathname.startsWith('/jobs')) return 'Jobs'
  if (pathname.startsWith('/notifications')) return 'Notifications'
  if (pathname.startsWith('/resources/nodes')) return 'Nodes'
  if (pathname.startsWith('/resources/gpus')) return 'GPUs'
  if (pathname.startsWith('/resources/datasets')) return 'Datasets'
  if (pathname.startsWith('/resources/environments')) return 'Environments'
  if (pathname.startsWith('/monitoring')) return 'Cluster Monitoring'
  if (pathname.startsWith('/account/profile')) return 'Profile'
  if (pathname.startsWith('/account/settings')) return 'Settings'
  return 'ClusterOne'
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
        <TopHeader title={titleForPath(location.pathname)} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1400px]">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}

function RouteFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  )
}
