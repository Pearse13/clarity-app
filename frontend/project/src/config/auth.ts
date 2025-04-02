// Log all Auth0 configuration for debugging
console.log('Auth0 Environment Variables:', {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  audience: import.meta.env.VITE_AUTH0_AUDIENCE,
  env: import.meta.env.VITE_ENV
});

// Auth0 Configuration
export const AUTH0_CONFIG = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
    redirect_uri: typeof window !== 'undefined' ? window.location.origin + '/callback' : undefined,
    scope: 'openid profile email offline_access'
  },
  cacheLocation: 'localstorage',
  useRefreshTokens: true,
  useRefreshTokensFallback: true
} as const;

// Log configuration in development
if (import.meta.env.DEV) {
  console.log('Auth0 Configuration:', {
    domain: AUTH0_CONFIG.domain,
    clientId: AUTH0_CONFIG.clientId,
    audience: AUTH0_CONFIG.authorizationParams.audience,
    redirect_uri: AUTH0_CONFIG.authorizationParams.redirect_uri,
    mode: import.meta.env.MODE
  });
}

export default AUTH0_CONFIG;