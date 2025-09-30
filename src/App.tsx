import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, ProtectedRoute } from './contexts/AuthContext'
import { ErrorProvider, ErrorBoundary } from './contexts/ErrorContext'
import { ToastContainer, useToast } from './components/Toast'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import DhcpManager from './pages/DhcpManager/Index'
import Dhcpv6Manager from './pages/Dhcpv6Manager/Index'
import DnsManager from './pages/DnsManager/Index'
import HaManager from './pages/HaManager/Index'
import StatisticsManager from './pages/StatisticsManager/Index'
import HooksManager from './pages/HooksManager/Index'
import ConfigBackendManager from './pages/ConfigBackendManager/Index'
import DdnsManager from './pages/DdnsManager/Index'
import OptionSetsManager from './pages/OptionSetsManager/Index'
import BulkOpsManager from './pages/BulkOpsManager/Index'
import Settings from './pages/Settings/Index'
import Login from './pages/Login'

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth()
  const toast = useToast()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      </>
    )
  }

  return (
    <>
      <AppShell>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/dhcp" element={
            <ProtectedRoute requiredPermission="canRead">
              <DhcpManager />
            </ProtectedRoute>
          } />
          <Route path="/dhcpv6" element={
            <ProtectedRoute requiredPermission="canRead">
              <Dhcpv6Manager />
            </ProtectedRoute>
          } />
          <Route path="/dns" element={
            <ProtectedRoute requiredPermission="canRead">
              <DnsManager />
            </ProtectedRoute>
          } />
          <Route path="/ha" element={
            <ProtectedRoute requiredPermission="canRead">
              <HaManager />
            </ProtectedRoute>
          } />
          <Route path="/statistics" element={
            <ProtectedRoute requiredPermission="canRead">
              <StatisticsManager />
            </ProtectedRoute>
          } />
          <Route path="/hooks" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <HooksManager />
            </ProtectedRoute>
          } />
          <Route path="/config-backend" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <ConfigBackendManager />
            </ProtectedRoute>
          } />
          <Route path="/ddns" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <DdnsManager />
            </ProtectedRoute>
          } />
          <Route path="/option-sets" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <OptionSetsManager />
            </ProtectedRoute>
          } />
          <Route path="/bulk-ops" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <BulkOpsManager />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute requiredPermission="canManageConfig">
              <Settings />
            </ProtectedRoute>
          } />
        </Routes>
      </AppShell>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ErrorProvider>
            <AppRoutes />
          </ErrorProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

