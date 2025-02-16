import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Auth0Provider } from '@auth0/auth0-react'
import App from './App'
import './index.css'
import authConfig from './config/auth'

// Ensure we're in a browser context
if (typeof window === 'undefined') {
  throw new Error('Application requires a browser environment');
}

// Wait for the DOM to be fully loaded
const init = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  try {
    // Create root and render app
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <Auth0Provider
          {...authConfig}
          onRedirectCallback={(appState) => {
            // Use direct navigation instead of history manipulation
            window.location.href = appState?.returnTo || '/transform';
          }}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </Auth0Provider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Error initializing app:', error);
  }
};

// Initialize immediately if DOM is ready, otherwise wait for it
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
