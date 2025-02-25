import { Auth0ClientOptions } from '@auth0/auth0-spa-js';

const isDevelopment = import.meta.env.VITE_ENV === 'development';

// Log all Auth0 configuration for debugging
console.log('Auth0 Environment Variables:', {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  audience: import.meta.env.VITE_AUTH0_AUDIENCE,
  env: import.meta.env.VITE_ENV
});

// Build auth params, always including audience and scope
const authorizationParams: any = {
  redirect_uri: import.meta.env.VITE_AUTH0_CALLBACK_URL || `${window.location.origin}/callback`,
  scope: 'openid profile email offline_access',
  audience: import.meta.env.VITE_AUTH0_AUDIENCE
};

const config: Auth0ClientOptions = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams,
  useRefreshTokens: true,
  cacheLocation: 'localstorage'
};

// Log configuration in development only
if (isDevelopment) {
  console.log('Auth0 Config:', {
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    redirect_uri: authorizationParams.redirect_uri,
    audience: authorizationParams.audience,
    scope: authorizationParams.scope,
    environment: import.meta.env.VITE_ENV
  });
}

export default config;