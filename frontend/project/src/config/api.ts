const isDevelopment = import.meta.env.VITE_ENV === 'development';

// Force production URL for now to ensure connection to Railway
export const API_URL = import.meta.env.VITE_PRODUCTION_API_URL || 'https://clarity-backend-production.up.railway.app';

// Log the API URL being used
console.log('Using API URL:', API_URL);

export const API_ENDPOINTS = {
  transform: `${API_URL}/api/transform`
};

// Verify the API configuration
function verifyApiConfig() {
  const missingVars = [];
  
  if (!import.meta.env.VITE_API_BASE_URL && isDevelopment) {
    missingVars.push('VITE_API_BASE_URL');
    console.warn('Warning: VITE_API_BASE_URL is not defined, using fallback: http://localhost:8000');
  }
  
  if (!import.meta.env.VITE_PRODUCTION_API_URL && !isDevelopment) {
    missingVars.push('VITE_PRODUCTION_API_URL');
    console.warn('Warning: VITE_PRODUCTION_API_URL is not defined, using fallback: https://api.clarity.app');
  }
  
  // Log configuration
  console.log('API Config:', {
    apiUrl: API_URL,
    environment: import.meta.env.VITE_ENV,
    endpoints: API_ENDPOINTS,
    missingVars: missingVars.length > 0 ? missingVars : 'None'
  });
  
  return missingVars.length === 0;
}

// Run verification in all environments
verifyApiConfig(); 