// API configuration
const isDevelopment = import.meta.env.MODE === 'development';

// API URL is different for development vs. production
export const API_URL = 'https://clarity-backend-production.up.railway.app';

console.log(`Using API URL: ${API_URL}`);

// API endpoints
export const API_ENDPOINTS = {
  transform: `${API_URL}/api/transform`,
  transformer: `${API_URL}/api/transformer`,
  upload: `${API_URL}/api/presentations/create`,
  document: `${API_URL}/api/documents/create`,
  health: `${API_URL}/health`,
  chat: {
    send: `${API_URL}/chat`,
    health: `${API_URL}/chat/health`
  }
};

// Verify API configuration
export function verifyApiConfig(): void {
  const requiredEnvVars = [
    'VITE_AUTH0_DOMAIN',
    'VITE_AUTH0_CLIENT_ID',
    'VITE_AUTH0_AUDIENCE'
  ];
  
  const warnings: string[] = [];
  
  // Check for missing environment variables
  requiredEnvVars.forEach(envVar => {
    if (!import.meta.env[envVar]) {
      warnings.push(`Missing environment variable: ${envVar}`);
    }
  });
  
  // Log warnings for missing variables
  if (warnings.length > 0) {
    console.warn('API Configuration Warnings:', warnings);
  }
  
  // Log current API configuration
  console.log('API Configuration:', {
    apiUrl: API_URL,
    endpoints: API_ENDPOINTS,
    isDevelopment
  });
} 