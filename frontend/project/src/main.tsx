import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { Auth0Provider } from '@auth0/auth0-react'
import * as Sentry from "@sentry/react";
import App from './App'
import './index.css'
import authConfig from './config/auth'

// Initialize Sentry
if (import.meta.env.VITE_ENV === 'production') {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      new Sentry.BrowserTracing({
        tracePropagationTargets: [import.meta.env.VITE_PRODUCTION_API_URL],
      }),
      new Sentry.Replay(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

const Auth0ProviderWithNavigate = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();

  // Add a console log to track redirect
  console.log('Setting up Auth0 with config:', {
    domain: authConfig.domain,
    clientId: authConfig.clientId,
    redirectUri: authConfig.authorizationParams?.redirect_uri,
  });

  const onRedirectCallback = (appState: any) => {
    // After login, navigate to returnTo or transform
    console.log('Auth0 redirect callback triggered with appState:', appState);
    navigate(appState?.returnTo || '/transform', { replace: true });
  };

  // Add error event handler
  const onError = (error: Error) => {
    console.error('Auth0 error:', error);
    navigate('/callback?error=auth0_error&error_description=' + encodeURIComponent(error.message));
  };

  // Add event listener for Auth0 errors
  useEffect(() => {
    const handleAuth0Error = (event: ErrorEvent) => {
      console.error('Auth0 script error:', event.error || event.message);
      if (event.error && 
         (event.error.toString().includes('Auth0') || 
          event.message?.includes('Auth0'))) {
        navigate('/callback?error=auth0_error&error_description=' + 
          encodeURIComponent(event.message || 'Authentication error occurred'));
      }
    };
    
    window.addEventListener('error', handleAuth0Error);
    return () => window.removeEventListener('error', handleAuth0Error);
  }, [navigate]);

  return (
    <Auth0Provider
      {...authConfig}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
};

// Initialize immediately if DOM is ready, otherwise wait for it
const init = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <Sentry.ErrorBoundary fallback={<div>An error has occurred</div>}>
          <BrowserRouter>
            <Auth0ProviderWithNavigate>
              <App />
            </Auth0ProviderWithNavigate>
          </BrowserRouter>
        </Sentry.ErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Error initializing app:', error);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

