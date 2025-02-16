interface Config {
  apiUrl: string;
  auth0: {
    domain: string;
    clientId: string;
    audience: string;
  };
}

const config: Config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  auth0: {
    domain: import.meta.env.VITE_AUTH0_DOMAIN || '',
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
    audience: import.meta.env.VITE_AUTH0_AUDIENCE || '',
  },
};

if (!config.auth0.domain || !config.auth0.clientId) {
  throw new Error('Missing required Auth0 configuration');
}

export default config; 