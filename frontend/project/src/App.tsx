import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import TryClarity from './pages/TryClarity';
import Callback from './pages/Callback';
import TransformPage from './pages/TransformPage';
import LecturePage from './pages/LecturePage';
import { SidebarProvider } from './contexts/SidebarContext';

const App: React.FC = () => {
  const { logout, isAuthenticated, isLoading, user } = useAuth0();
  const location = useLocation();
  const navigate = useNavigate();

  // Simplified route guard - only redirect on initial load
  useEffect(() => {
    if (!isLoading && isAuthenticated && location.pathname === '/') {
      navigate('/lecture', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location.pathname]);

  // Only show loading on initial auth check
  if (isLoading) {
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
      <div className="min-h-screen overflow-visible">
        <nav className="p-4 flex justify-between items-center bg-white shadow-sm border-b-2 border-blue-300">
          <div className="flex items-center gap-3">
            <img 
              src="/clarity-logo.jpg" 
              alt="Clarity Logo" 
              className="w-8 h-8 object-contain"
            />
            <span className="text-logo font-medium tracking-tight">
              Clarity<span className="text-[0.425rem] align-top ml-1 text-blue-400">© 2025</span>
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
                  className="py-2 px-4 text-sm font-medium bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </nav>

        <Routes>
          <Route path="/" element={
            isAuthenticated ? <Navigate to="/lecture" replace /> : <TryClarity />
          } />
          
          <Route path="/callback" element={<Callback />} />
          
          <Route path="/transform" element={
            isAuthenticated ? <TransformPage /> : <Navigate to="/" replace />
          } />

          <Route path="/lecture" element={
            isAuthenticated ? <LecturePage /> : <Navigate to="/" replace />
          } />
          
          <Route path="*" element={
            <Navigate to={isAuthenticated ? '/lecture' : '/'} replace />
          } />
        </Routes>
      </div>
    </SidebarProvider>
  );
};

export default App;