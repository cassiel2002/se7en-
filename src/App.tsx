import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginForm } from './components/Auth/LoginForm';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Clientes } from './pages/Clientes';
import { Agenda } from './pages/Agenda';
import { Servicios } from './pages/Servicios';
import { Ventas } from './pages/Ventas';
import { Reportes } from './pages/Reportes';
import { Cajeros } from './pages/Cajeros';
import { CajeroDashboard } from './pages/CajeroDashboard';
import { GestionEncargados } from './pages/GestionEncargados';
import { initializeDefaultUsers } from './firebase/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalLoading } from './components/GlobalLoading';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

// ProtectedRoute component now ensures user is authenticated and has required role(s)
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRoles?: string[] }> = ({
  children,
  requiredRoles
}) => {
  const { user, profile, loading } = useAuth();

  // Handle initial loading state - AppRoutes handles this for the entire app
  if (loading) {
    return <GlobalLoading message="Verificando permisos..." />;
  }

  // If not authenticated, redirect to login
  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated but role doesn't match, redirect to appropriate dashboard
  if (requiredRoles && !requiredRoles.includes(profile.role)) {
    if (profile.role === 'cashier') {
      return <Navigate to="/cajero/clientes" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // If all checks pass, render children
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const location = useLocation(); // Mantener useLocation para verificar la ruta actual

  // Show a loading spinner while authentication state is being determined
  if (loading) {
    return <GlobalLoading message="Iniciando Se7en..." />;
  }

  // If user is not authenticated, show only the Login Form or redirect to it
  if (!user || !profile) {
    // If not already on the login page, redirect to it
    if (location.pathname !== '/login') {
      return <Navigate to="/login" replace />;
    }
    // If on the login page, render the LoginForm
    return (
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        {/* Catch-all for any other path if not authenticated, redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // If user is authenticated, render the Layout and protected routes
  return (
    <Layout>
      <Routes>
        {/* Default redirect from root based on user role when already authenticated */}
        <Route path="/" element={profile?.role === 'cashier' ? <Navigate to="/cajero/clientes" replace /> : <Navigate to="/dashboard" replace />} />

        {/* Protected routes accessible to both admin and cashier, but requiring login (already handled by AppRoutes checking `user` and `profile` above) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/ventas" element={<Ventas />} />

        {/* Admin-only routes - these still need ProtectedRoute for role check */}
        <Route path="/servicios" element={<ProtectedRoute requiredRoles={['admin']}><Servicios /></ProtectedRoute>} />
        <Route path="/reportes" element={<ProtectedRoute requiredRoles={['admin']}><Reportes /></ProtectedRoute>} />
        <Route path="/cajeros" element={<ProtectedRoute requiredRoles={['admin']}><Cajeros /></ProtectedRoute>} />
        <Route path="/encargados" element={<ProtectedRoute requiredRoles={['admin']}><GestionEncargados /></ProtectedRoute>} />

        {/* Cashier Dashboard nested routes - also needs ProtectedRoute for role check on the parent */}
        <Route path="/cajero" element={<ProtectedRoute requiredRoles={['cashier']}><CajeroDashboard /></ProtectedRoute>}>
          <Route index element={<Navigate to="clientes" replace />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="ventas" element={<Ventas />} />
        </Route>

        {/* Catch-all for any unmatched paths within the protected layout */}
        <Route path="*" element={
          profile?.role === 'cashier' ? 
            <Navigate to="/cajero/clientes" replace /> : 
            <Navigate to="/dashboard" replace />
        } />
      </Routes>
    </Layout>
  );
};

function App() {
  useEffect(() => {
    initializeDefaultUsers();
    
    // Registrar Service Worker para PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/se7en/sw.js')
        .then((registration) => {
          console.log('🔧 Service Worker registrado:', registration.scope);
          
          // Verificar si hay actualizaciones
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nueva versión disponible
                  if (confirm('Nueva versión disponible. ¿Recargar la aplicación?')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.log('❌ Error registrando Service Worker:', error);
        });
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="App">
            <AppRoutes />
            <PWAInstallPrompt />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1F2937',
                  color: '#FFFFFF',
                  border: '1px solid #374151'
                },
                success: {
                  iconTheme: {
                    primary: '#E0002B',
                    secondary: '#FFFFFF'
                  }
                },
                error: {
                  iconTheme: {
                    primary: '#EF4444',
                    secondary: '#FFFFFF'
                  }
                }
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;