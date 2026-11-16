import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { UserProvider } from '@/context/UserContext'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'

const JobsList = lazy(() => import('@/pages/JobsList').then((m) => ({ default: m.JobsList })))
const ClusterJobs = lazy(() => import('@/pages/ClusterJobs').then((m) => ({ default: m.ClusterJobs })))
const SubmitJobPage = lazy(() => import('@/pages/SubmitJob').then((m) => ({ default: m.SubmitJobPage })))
const JobDetails = lazy(() => import('@/pages/JobDetails').then((m) => ({ default: m.JobDetails })))
const JobHistory = lazy(() => import('@/pages/JobHistory').then((m) => ({ default: m.JobHistory })))
const Notifications = lazy(() => import('@/pages/Notifications').then((m) => ({ default: m.Notifications })))
const NodesPage = lazy(() => import('@/pages/NodesPage').then((m) => ({ default: m.NodesPage })))
const GpusPage = lazy(() => import('@/pages/GpusPage').then((m) => ({ default: m.GpusPage })))
const DatasetsPage = lazy(() => import('@/pages/DatasetsPage').then((m) => ({ default: m.DatasetsPage })))
const EnvironmentsPage = lazy(() => import('@/pages/EnvironmentsPage').then((m) => ({ default: m.EnvironmentsPage })))
const ClusterMonitoring = lazy(() => import('@/pages/ClusterMonitoring').then((m) => ({ default: m.ClusterMonitoring })))
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })))
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })))
const LoggedOut = lazy(() => import('@/pages/LoggedOut').then((m) => ({ default: m.LoggedOut })))
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })))

function App() {
  return (
    <UserProvider>
      <NotificationsProvider>
        <BrowserRouter>
          <Routes>
            {/* Standalone, outside the app shell (no sidebar/header) */}
            <Route
              path="/logout"
              element={
                <Suspense fallback={null}>
                  <LoggedOut />
                </Suspense>
              }
            />

            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/run" element={<ClusterJobs />} />

            <Route
              path="/jobs"
              element={<JobsList title="All Jobs" emptyTitle="No Jobs Yet" emptyDescription="You haven't submitted any jobs." />}
            />
            <Route
              path="/jobs/running"
              element={
                <JobsList
                  statusIn={['RUNNING']}
                  title="Running Jobs"
                  emptyTitle="No Running Jobs"
                  emptyDescription="Your compute resources are currently free."
                />
              }
            />
            <Route
              path="/jobs/queued"
              element={
                <JobsList
                  statusIn={['QUEUED']}
                  title="Queued Jobs"
                  emptyTitle="Queue is Empty"
                  emptyDescription="No jobs are currently waiting for resources."
                />
              }
            />
            <Route
              path="/jobs/completed"
              element={
                <JobsList
                  statusIn={['COMPLETED']}
                  title="Completed Jobs"
                  emptyTitle="No Completed Jobs"
                  emptyDescription="Jobs that finish successfully will appear here."
                />
              }
            />
            <Route
              path="/jobs/failed"
              element={
                <JobsList
                  statusIn={['FAILED', 'TIMEOUT']}
                  title="Failed Jobs"
                  emptyTitle="No Failed Jobs"
                  emptyDescription="Jobs that fail or exceed their runtime will appear here."
                />
              }
            />
            <Route
              path="/jobs/cancelled"
              element={
                <JobsList
                  statusIn={['CANCELLED']}
                  title="Cancelled Jobs"
                  emptyTitle="No Cancelled Jobs"
                  emptyDescription="Jobs you cancel will appear here."
                />
              }
            />
            <Route path="/jobs/history" element={<JobHistory />} />
            <Route path="/jobs/new" element={<SubmitJobPage />} />
            <Route path="/jobs/:id/*" element={<JobDetails />} />

            <Route path="/notifications" element={<Notifications />} />

            <Route path="/resources/nodes" element={<NodesPage />} />
            <Route path="/resources/gpus" element={<GpusPage />} />
            <Route path="/resources/datasets" element={<DatasetsPage />} />
            <Route path="/resources/environments" element={<EnvironmentsPage />} />

            <Route path="/monitoring" element={<ClusterMonitoring />} />

            <Route path="/account/profile" element={<Profile />} />
            <Route path="/account/settings" element={<Settings />} />

            <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </NotificationsProvider>
    </UserProvider>
  )
}

export default App
