import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { UserProvider } from '@/context/UserContext'
import { ActiveNodeProvider } from '@/context/ActiveNodeContext'
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
const TrainingPage = lazy(() => import('@/pages/TrainingPage').then((m) => ({ default: m.TrainingPage })))
const DatasetsPage = lazy(() => import('@/pages/DatasetsPage').then((m) => ({ default: m.DatasetsPage })))
const EnvironmentsPage = lazy(() => import('@/pages/EnvironmentsPage').then((m) => ({ default: m.EnvironmentsPage })))
const StoragePage = lazy(() => import('@/pages/StoragePage').then((m) => ({ default: m.StoragePage })))
const ClusterMonitoring = lazy(() => import('@/pages/ClusterMonitoring').then((m) => ({ default: m.ClusterMonitoring })))
const ActivityPage = lazy(() => import('@/pages/ActivityPage').then((m) => ({ default: m.ActivityPage })))
const DocumentationPage = lazy(() => import('@/pages/DocumentationPage').then((m) => ({ default: m.DocumentationPage })))

const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })))
const AdminPartitionsPage = lazy(() => import('@/pages/admin/AdminPartitionsPage').then((m) => ({ default: m.AdminPartitionsPage })))
const AdminPoliciesPage = lazy(() => import('@/pages/admin/AdminPoliciesPage').then((m) => ({ default: m.AdminPoliciesPage })))
const AdminSystemPage = lazy(() => import('@/pages/admin/AdminSystemPage').then((m) => ({ default: m.AdminSystemPage })))
const AdminAuditPage = lazy(() => import('@/pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })))

const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })))
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })))
const LoggedOut = lazy(() => import('@/pages/LoggedOut').then((m) => ({ default: m.LoggedOut })))
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })))

function App() {
  return (
    <UserProvider>
      <ActiveNodeProvider>
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

              {/* Jobs section */}
              <Route
                path="/jobs"
                element={<JobsList title="All Workloads" emptyTitle="No Workloads Yet" emptyDescription="Submit a new job to start training on cluster GPUs." />}
              />
              <Route
                path="/jobs/running"
                element={
                  <JobsList
                    statusIn={['RUNNING']}
                    title="Running Workloads"
                    emptyTitle="No Running Workloads"
                    emptyDescription="Compute nodes are currently ready for new jobs."
                  />
                }
              />
              <Route
                path="/jobs/queued"
                element={
                  <JobsList
                    statusIn={['QUEUED', 'SUBMITTED', 'SCHEDULED']}
                    title="Queued Workloads"
                    emptyTitle="Queue is Empty"
                    emptyDescription="No jobs are currently waiting for GPU nodes."
                  />
                }
              />
              <Route
                path="/jobs/completed"
                element={
                  <JobsList
                    statusIn={['COMPLETED']}
                    title="Completed Workloads"
                    emptyTitle="No Completed Workloads"
                    emptyDescription="Jobs that finish successfully will appear here."
                  />
                }
              />
              <Route
                path="/jobs/failed"
                element={
                  <JobsList
                    statusIn={['FAILED', 'TIMEOUT']}
                    title="Failed Workloads"
                    emptyTitle="No Failed Workloads"
                    emptyDescription="Jobs that exit with error will appear here."
                  />
                }
              />
              <Route
                path="/jobs/cancelled"
                element={
                  <JobsList
                    statusIn={['CANCELLED']}
                    title="Cancelled Workloads"
                    emptyTitle="No Cancelled Workloads"
                    emptyDescription="Jobs you cancel will appear here."
                  />
                }
              />
              <Route path="/jobs/history" element={<JobHistory />} />
              <Route path="/jobs/new" element={<SubmitJobPage />} />
              <Route path="/jobs/:id/*" element={<JobDetails />} />

              {/* Infrastructure & Research resources */}
              <Route path="/nodes" element={<NodesPage />} />
              <Route path="/resources/nodes" element={<NodesPage />} />
              <Route path="/gpus" element={<GpusPage />} />
              <Route path="/resources/gpus" element={<GpusPage />} />
              <Route path="/training" element={<TrainingPage />} />
              <Route path="/datasets" element={<DatasetsPage />} />
              <Route path="/resources/datasets" element={<DatasetsPage />} />
              <Route path="/resources/environments" element={<EnvironmentsPage />} />
              <Route path="/storage" element={<StoragePage />} />
              <Route path="/monitoring" element={<ClusterMonitoring />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/documentation" element={<DocumentationPage />} />

              {/* Admin section */}
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/partitions" element={<AdminPartitionsPage />} />
              <Route path="/admin/policies" element={<AdminPoliciesPage />} />
              <Route path="/admin/system" element={<AdminSystemPage />} />
              <Route path="/admin/audit" element={<AdminAuditPage />} />

              {/* User Account */}
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/account/profile" element={<Profile />} />
              <Route path="/account/settings" element={<Settings />} />

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </NotificationsProvider>
      </ActiveNodeProvider>
    </UserProvider>
  )
}

export default App
