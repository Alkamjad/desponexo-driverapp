import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { App } from '@capacitor/app';

const TAB_PAGES = ['Dashboard', 'Uebersicht', 'DriverHome', 'Abrechnung', 'Profil'];

export function useBackStackNavigation(currentPageName) {
  const navigate = useNavigate();
  const backStackRef = useRef([]);

  // Initialisiere Back-Stack wenn Seite sich ändert
  useEffect(() => {
    if (TAB_PAGES.includes(currentPageName)) {
      // Entferne die aktuelle Seite falls sie bereits oben im Stack ist
      backStackRef.current = backStackRef.current.filter(page => page !== currentPageName);
      // Füge neue Seite hinzu
      backStackRef.current.push(currentPageName);
      // Begrenze Stack auf letzte 10 Seiten
      if (backStackRef.current.length > 10) {
        backStackRef.current.shift();
      }
    }
  }, [currentPageName]);

  // Hardware Back-Button Handler (Android)
  useEffect(() => {
    const handleBackButton = async () => {
      const stack = backStackRef.current;
      
      // Wenn wir auf einer Tab-Seite sind
      if (TAB_PAGES.includes(currentPageName)) {
        // Wenn Stack mehr als eine Seite hat, gehe zur vorherigen
        if (stack.length > 1) {
          const previousPage = stack[stack.length - 2];
          backStackRef.current.pop(); // Entferne aktuelle Seite
          navigate(createPageUrl(previousPage));
        } else {
          // Wenn nur eine Tab-Seite, gehe zu Dashboard
          if (currentPageName !== 'Dashboard') {
            backStackRef.current = ['Dashboard'];
            navigate(createPageUrl('Dashboard'));
          } else {
            // Auf Dashboard - App schließen
            await App.exitApp();
          }
        }
      } else {
        // Nicht-Tab-Seiten: Standardmäßig eine Seite zurück
        navigate(-1);
      }
    };

    // Browser Back nur für Tab-Seiten abfangen (sonst Default-Verhalten zulassen)
    let removePopState = null;
    if (TAB_PAGES.includes(currentPageName)) {
      const handlePopState = (e) => {
        e.preventDefault?.();
        handleBackButton();
      };
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
      removePopState = () => window.removeEventListener('popstate', handlePopState);
    }

    // Capacitor Hardware Back Button (optional, nur auf Native Platforms)
    let unsubscribeCapacitor = null;
    if (typeof window !== 'undefined' && window.CapacitorApp) {
      try {
        const listener = window.CapacitorApp.addListener('backButton', handleBackButton);
        if (listener && typeof listener.remove === 'function') {
          unsubscribeCapacitor = () => listener.remove();
        }
      } catch (e) {
        // Capacitor nicht verfügbar
      }
    }

    return () => {
      if (unsubscribeCapacitor) {
        try { unsubscribeCapacitor(); } catch (e) {}
      }
      if (removePopState) {
        try { removePopState(); } catch (e) {}
      }
    };
  }, [currentPageName, navigate]);

  return backStackRef;
}