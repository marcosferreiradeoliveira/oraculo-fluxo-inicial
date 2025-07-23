import { useEffect } from 'react';

export const EnvDebug = () => {
  useEffect(() => {
    console.log('=== Environment Variables ===');
    console.log('VITE_API_KEY exists:', !!import.meta.env.VITE_API_KEY);
    console.log('VITE_AUTH_DOMAIN exists:', !!import.meta.env.VITE_AUTH_DOMAIN);
    console.log('VITE_PROJECT_ID exists:', !!import.meta.env.VITE_PROJECT_ID);
    console.log('VITE_STORAGE_BUCKET exists:', !!import.meta.env.VITE_STORAGE_BUCKET);
    console.log('VITE_MESSAGING_SENDER_ID exists:', !!import.meta.env.VITE_MESSAGING_SENDER_ID);
    console.log('VITE_APP_ID exists:', !!import.meta.env.VITE_APP_ID);
    
    // Don't log the full values for security
    if (import.meta.env.VITE_API_KEY) {
      console.log('API Key starts with:', import.meta.env.VITE_API_KEY.substring(0, 10) + '...');
    }
  }, []);

  // This component doesn't render anything visible
  return null;
};
