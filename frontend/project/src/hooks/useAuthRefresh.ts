import { useAuth0 } from '@auth0/auth0-react';

export const useAuthRefresh = () => {
  const { getAccessTokenSilently } = useAuth0();

  const handleTokenRefresh = async (): Promise<boolean> => {
    try {
      await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        },
        detailedResponse: true
      });
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  return { handleTokenRefresh };
}; 