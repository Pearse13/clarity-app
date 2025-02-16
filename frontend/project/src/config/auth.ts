import { Auth0ClientOptions } from '@auth0/auth0-spa-js';

const config: Auth0ClientOptions = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: import.meta.env.VITE_AUTH0_CALLBACK_URL || window.location.origin,
    scope: 'openid profile email offline_access',
    audience: import.meta.env.VITE_AUTH0_AUDIENCE
  },
  useRefreshTokens: true,
  cacheLocation: 'localstorage',
  useFormData: true
};

export default config;