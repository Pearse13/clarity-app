import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import TryClarity from './pages/TryClarity';
import Callback from './pages/Callback';
import TransformPage from './pages/TransformPage';
import LecturePage from './pages/LecturePage';
import { SidebarProvider } from './contexts/SidebarContext';

// Protected route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const [redirectingToLogin, setRedirectingToLogin] = useState(false);

  React.useEffect(() => {
    // Only redirect to login if not authenticated, not loading, and not already redirecting
    if (!isAuthenticated && !isLoading && !redirectingToLogin) {
      console.log('User is not authenticated, redirecting to login');
      setRedirectingToLogin(true);
      loginWithRedirect({
        authorizationParams: {
          prompt: 'login',
          response_type: 'code'
        }
      });
    }
  }, [isAuthenticated, isLoading, loginWithRedirect, redirectingToLogin]);

  // Show loading state while checking auth or during redirect
  if (isLoading || redirectingToLogin || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">↻</div>
          <p className="text-gray-600">{isLoading ? 'Checking authentication...' : 'Redirecting to login...'}</p>
        </div>
      </div>
    );
  }

  // Only render children if authenticated
  return isAuthenticated ? <>{children}</> : null;
};

// Public route component - redirects to transform if authenticated
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();

  // Keep track of loading state to avoid flicker
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Only redirect if authenticated and not in the process of loading
    if (isAuthenticated && !isLoading && !redirecting) {
      console.log('User is authenticated, redirecting from public route to transform');
      setRedirecting(true);
      navigate('/transform', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirecting]);

  // Show loading spinner during auth check
  if (isLoading || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">↻</div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Only render children if not authenticated
  return !isAuthenticated ? <>{children}</> : null;
};

const App: React.FC = () => {
  const { logout, isAuthenticated, isLoading, user } = useAuth0();
  const location = useLocation();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);

  // Global route guard - ensure users are in the right place based on auth state
  useEffect(() => {
    // Skip during loading or when already redirecting
    if (isLoading || redirecting) return;

    const publicPaths = ['/', '/callback'];
    const protectedPaths = ['/transform', '/lecture'];
    const currentPath = location.pathname;

    // If authenticated user tries to access a public path (except callback)
    if (isAuthenticated && publicPaths.includes(currentPath) && currentPath !== '/callback') {
      console.log('Authenticated user tried to access public path, redirecting to transform');
      setRedirecting(true);
      navigate('/transform', { replace: true });
    } 
    // If unauthenticated user tries to access a protected path
    else if (!isAuthenticated && protectedPaths.includes(currentPath)) {
      console.log('Unauthenticated user tried to access protected path, redirecting to home');
      setRedirecting(true);
      navigate('/', { replace: true });
    } else {
      // Reset redirecting state when on correct path
      setRedirecting(false);
    }
  }, [isAuthenticated, location.pathname, navigate, isLoading, redirecting]);

  // Show loading during auth check or redirects
  if (isLoading || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">↻</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background">
        <nav className="p-4 flex justify-between items-center bg-white/80 backdrop-blur-card shadow-sm">
          <div className="flex items-center gap-3">
            <img 
              src="/clarity-logo.jpg" 
              alt="Clarity Logo"
              className="w-8 h-8 object-cover rounded-lg" 
            />
            <span className="text-logo font-medium tracking-tight text-gray-900">
              Clarity<span className="text-[0.425rem] align-top ml-1">© 2025</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-base text-gray-600">{user?.name || user?.email}</span>
                </div>
                <button
                  onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                  className="py-2 px-4 text-sm font-medium bg-white/80 backdrop-blur text-gray-900 rounded-xl hover:brightness-95 transition-all"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </nav>

        <Routes>
          {/* Public Routes - only accessible when NOT authenticated */}
          <Route path="/" element={
            <PublicRoute>
              <TryClarity />
            </PublicRoute>
          } />
          
          {/* Auth Callback - special handling for Auth0 callback */}
          <Route path="/callback" element={<Callback />} />
          
          {/* Protected Routes - only accessible when authenticated */}
          <Route path="/transform" element={
            <ProtectedRoute>
              <TransformPage />
            </ProtectedRoute>
          } />

          <Route path="/lecture" element={
            <ProtectedRoute>
              <LecturePage />
            </ProtectedRoute>
          } />
          
          {/* Catch-all redirect */}
          <Route path="*" element={
            <Navigate to={isAuthenticated ? '/transform' : '/'} replace />
          } />
        </Routes>
      </div>
    </SidebarProvider>
  );
};

export default App;