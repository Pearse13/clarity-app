// API configuration
declare const __API_URL__: string;

// Use the API URL defined at build time
export const API_URL = __API_URL__;

console.log(`API Configuration:`, {
  apiUrl: API_URL,
  mode: import.meta.env.MODE
});

// API endpoints
export const API_ENDPOINTS = {
  transform: `${API_URL}/api/transform`,
  transformer: `${API_URL}/api/transformer`,
  upload: `${API_URL}/api/presentations/create`,
  document: `${API_URL}/api/documents/create`,
  health: `${API_URL}/api/health`,
  chat: {
    send: `${API_URL}/api/chat`,
    health: `${API_URL}/api/chat/health`
  }
};

// Verify API configuration
export function verifyApiConfig(): void {
  const requiredEnvVars: string[] = [
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
    mode: import.meta.env.MODE
  });
} 