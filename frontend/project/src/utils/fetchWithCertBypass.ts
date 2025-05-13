// Simple fetch wrapper for certificate error handling
export const fetchWithCertBypass = async (url: string, options: RequestInit) => {
  try {
    // Try standard fetch with no-cache to avoid caching issues
    const response = await fetch(url, {
      ...options,
      cache: 'no-cache'
    });
    return response;
  } catch (error: any) {
    console.error('Fetch error:', error);
    
    // If there's an error that appears to be certificate-related, try alternative approaches
    if (error.message && (
      error.message.includes('certificate') || 
      error.message.includes('SSL') || 
      error.message.includes('TLS')
    )) {
      console.warn('Certificate error detected, trying alternative approach');
      
      // Try with more permissive options
      try {
        const retryResponse = await fetch(url, {
          ...options,
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'include',
          redirect: 'follow'
        });
        
        return retryResponse;
      } catch (retryError) {
        console.error('Alternative fetch approach also failed:', retryError);
        throw new Error(`Certificate validation error. Please check console for details. Original error: ${error.message}`);
      }
    }
    
    // If it's not a certificate error or the retry failed, throw the original error
    throw error;
  }
}; 