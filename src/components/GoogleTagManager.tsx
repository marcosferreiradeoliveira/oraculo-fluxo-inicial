import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    dataLayer: any[];
  }
}

const GTM_ID = 'GTM-MSGBFJ8D';

// Initialize GTM script
const initializeGTM = () => {
  if (typeof window === 'undefined') return;
  
  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  
  // Add GTM script if not already added
  if (!document.getElementById('gtm-script')) {
    // Push configuration to dataLayer before GTM loads
    window.dataLayer.push({
      'gtm.start': new Date().getTime(),
      event: 'gtm.js',
      'gtm.allowlist': ['k', 'l', 'm'],
      'gtm.blocklist': ['j', 's'],
      'gtm.whitelist': ['k', 'l', 'm'],
      'gtm.blacklist': ['j', 's'],
      'gtm.allowLinker': true,
      'gtm.cookieDomain': 'auto',
      'gtm.cookieFlags': 'SameSite=None;Secure'
    });

    // Create GTM script
    const gtmScript = document.createElement('script');
    gtmScript.id = 'gtm-script';
    gtmScript.async = true;
    gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    
    // Add error handling
    gtmScript.onerror = () => {
      console.error('Failed to load GTM script. Check your network connection and GTM container ID.');
    };
    
    // Insert script before the first script tag or at the end of head
    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(gtmScript, firstScript);
    } else {
      document.head.insertBefore(gtmScript, null);
    }
  }
};

export const GoogleTagManager = () => {
  const initialized = useRef(false);
  
  // Initialize GTM on mount
  useEffect(() => {
    if (!initialized.current) {
      initializeGTM();
      initialized.current = true;
    }
  }, []);
  
  // Try to use location if Router is available
  try {
    // This will only work if inside a Router
    const location = useLocation();
    
    // Track page views on route change
    useEffect(() => {
      if (window.dataLayer) {
        window.dataLayer.push({
          event: 'pageview',
          page: location.pathname + location.search,
        });
      }
    }, [location]);
  } catch (e) {
    // If useLocation throws, we're not in a Router context
    // We'll just initialize GTM without route tracking
    console.log('GTM: Not in Router context, initializing without route tracking');
  }

  // Add noscript fallback
  const GTMNoScript = () => (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );

  return (
    <>
      {/* GTM Script */}
      <GTMNoScript />
    </>
  );
};

export default GoogleTagManager;
