// src/components/GoogleTagManager.tsx
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
    if (firstScript?.parentNode) {
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

  // Add noscript fallback
  return (
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
};

// New component for route tracking
export const GoogleTagManagerRouteTracker = () => {
  const location = useLocation();
  
  // Track page views on route change
  useEffect(() => {
    // Wait a bit to ensure GTM is loaded
    const trackPageView = () => {
      if (window.dataLayer) {
        const pageLocation = window.location.href;
        const pagePath = location.pathname + location.search;
        const pageTitle = document.title || 'Oráculo Cultural';

        // Push page_view event to dataLayer (GA4 format)
        window.dataLayer.push({
          event: 'page_view',
          page_location: pageLocation,
          page_path: pagePath,
          page_title: pageTitle,
        });

        // Also push for legacy GTM compatibility
        window.dataLayer.push({
          event: 'virtualPageView',
          virtualPageURL: pagePath,
          virtualPageTitle: pageTitle,
        });

        console.log('[GTM] Page view tracked:', pagePath);
      }
    };

    // Small delay to ensure GTM is ready
    const timer = setTimeout(trackPageView, 100);
    
    return () => clearTimeout(timer);
  }, [location]);

  return null;
};

export default GoogleTagManager;