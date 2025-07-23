// Test file to check if environment variables are being loaded correctly
console.log('Environment Variables Test:');
console.log('VITE_API_KEY exists:', !!import.meta.env.VITE_API_KEY);
console.log('VITE_AUTH_DOMAIN exists:', !!import.meta.env.VITE_AUTH_DOMAIN);
console.log('VITE_PROJECT_ID exists:', !!import.meta.env.VITE_PROJECT_ID);

// Don't log the actual values for security
if (import.meta.env.VITE_API_KEY) {
  console.log('API Key starts with:', import.meta.env.VITE_API_KEY.substring(0, 10) + '...');
}
