import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginForm } from './components/Auth/LoginForm';
import { Layout } from './components/Layout/Layout';
import { logoutUser } from './firebase/auth';

// Carga diferida: cada pantalla se descarga solo cuando se visita
// (reduce el JavaScript inicial; Reportes/Excel no se bajan para el cajero).
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Clientes = lazy(() => import('./pages/Clientes').then((m) => ({ default: m.Clientes })));
const Agenda = lazy(() => import('./pages/Agenda').then((m) => ({ default: m.Agenda })));
const Servicios = lazy(() => import('./pages/Servicios').then((m) => ({ default: m.Servicios })));
const Ventas = lazy(() => import('./pages/Ventas').then((m) => ({ default: m.Ventas })));
const Reportes = lazy(() => import('./pages/Reportes').then((m) => ({ default: m.Reportes })));
const Cajeros = lazy(() => import('./pages/Cajeros').then((m) => ({ default: m.Cajeros })));
const Premios = lazy(() => import('./pages/Premios').then((m) => ({ default: m.Premios })));
const CajeroDashboard = lazy(() => import('./pages/CajeroDashboard').then((m) => ({ default: m.CajeroDashboard })));
const GestionEncargados = lazy(() => import('./pages/GestionEncargados').then((m) => ({ default: m.GestionEncargados })));
const GestionAdelantos = lazy(() => import('./pages/GestionAdelantos').then((m) => ({ default: m.GestionAdelantos })));
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

// Pantalla cuando hay sesión iniciada pero no se pudo cargar el perfil
// (sin conexión, límite diario de Firestore, perfil inexistente...).
const ProfileErrorScreen: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="min-h-screen bg-black flex items-center justify-center p-4">
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4" role="alert">
      <h1 className="text-xl font-bold text-white">No se pudo cargar tu perfil</h1>
      <p className="text-gray-300 text-sm">{message}</p>
      <div className="flex flex-col gap-2">
        <button
          onClick={onRetry}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg min-h-[48px]"
        >
          Reintentar
        </button>
        <button
          onClick={() => logoutUser()}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium py-3 rounded-lg min-h-[48px]"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  </div>
);

const AppRoutes: React.FC = () => {
  const { user, profile, loading, profileError, retryProfile } = useAuth();
  const location = useLocation(); // Mantener useLocation para verificar la ruta actual

  // Show a loading spinner while authentication state is being determined
  if (loading) {
    return <GlobalLoading message="Iniciando Se7en..." />;
  }

  if (user && !profile && profileError) {
    return <ProfileErrorScreen message={profileError} onRetry={retryProfile} />;
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
      <Suspense fallback={<GlobalLoading message="Cargando..." fullScreen={false} />}>
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
        <Route path="/premios" element={<Premios />} />
        <Route path="/reportes" element={<ProtectedRoute requiredRoles={['admin']}><Reportes /></ProtectedRoute>} />
        <Route path="/cajeros" element={<ProtectedRoute requiredRoles={['admin']}><Cajeros /></ProtectedRoute>} />
        <Route path="/encargados" element={<ProtectedRoute requiredRoles={['admin']}><GestionEncargados /></ProtectedRoute>} />
        <Route path="/adelantos" element={<ProtectedRoute requiredRoles={['admin']}><GestionAdelantos /></ProtectedRoute>} />

        {/* Cashier Dashboard nested routes - also needs ProtectedRoute for role check on the parent */}
        <Route path="/cajero" element={<ProtectedRoute requiredRoles={['cashier']}><CajeroDashboard /></ProtectedRoute>}>
          <Route index element={<Navigate to="clientes" replace />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="ventas" element={<Ventas />} />
          <Route path="adelantos" element={<GestionAdelantos />} />
        </Route>

        {/* Catch-all for any unmatched paths within the protected layout */}
        <Route path="*" element={
          profile?.role === 'cashier' ? 
            <Navigate to="/cajero/clientes" replace /> : 
            <Navigate to="/dashboard" replace />
        } />
      </Routes>
      </Suspense>
    </Layout>
  );
};

function App() {
  useEffect(() => {
    // Registrar Service Worker para PWA (solo en producción; la ruta sale de `base` en vite.config.ts)
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
        .then((registration) => {
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
          console.warn('Error registrando Service Worker:', error);
        });
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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