import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Capacitor } from '@capacitor/core';
import { callFunction } from '@/components/utils/callFunction';

/**
 * DEEP LINK HANDLER
 * 
 * Unterstützt:
 * - desponexo://tour/123
 * - desponexo://chat
 * - desponexo://payment
 * - https://desponexodriver.app/tour/123 (Universal Links)
 */

export function useDeepLinks() {
  const navigate = useNavigate();

  // Markiere Notification als gelesen wenn via Push geöffnet
  const markNotificationRead = async (notificationId) => {
    if (!notificationId) return;
    try {
      await callFunction('markNotificationRead', { notification_id: notificationId });
      console.log('✅ Notification als gelesen markiert:', notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  useEffect(() => {
    // Nur auf nativen Plattformen
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // App URL Listener (Deep Links)
    let listener = null;
    try {
      listener = CapacitorApp.addListener('appUrlOpen', (event) => {
        console.log('🔗 Deep Link geöffnet:', event.url);
        
        const url = event.url;
        handleDeepLinkURL(url);
      });
    } catch (e) {
      console.warn('Capacitor App not available:', e);
    }

    // Cleanup
    return () => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    };
  }, [navigate]);

  const handleDeepLinkURL = (url) => {
    try {
      // URL parsen
      let path = '';
      let queryParams = new URLSearchParams();
      
      // Custom Scheme: desponexo://tour/123?notification_id=456
      if (url.startsWith('desponexo://')) {
        const [pathPart, queryString] = url.replace('desponexo://', '').split('?');
        path = pathPart;
        if (queryString) queryParams = new URLSearchParams(queryString);
      }
      // Universal Link: https://desponexodriver.app/tour/123?notification_id=456
      else if (url.includes('desponexodriver.app/')) {
        const [pathPart, queryString] = url.split('desponexodriver.app/')[1].split('?');
        path = pathPart;
        if (queryString) queryParams = new URLSearchParams(queryString);
      }

      // Markiere Notification als gelesen wenn vorhanden
      const notificationId = queryParams.get('notification_id');
      if (notificationId) {
        markNotificationRead(notificationId);
      }

      if (!path) {
        navigate(createPageUrl('Dashboard'));
        return;
      }

      // Route Mapping
      const parts = path.split('/');
      const route = parts[0];
      const param = parts[1];

      switch(route) {
        case 'tour':
          if (param) {
            navigate(createPageUrl('TourDetails') + `?id=${param}`);
          } else {
            navigate(createPageUrl('DriverHome'));
          }
          break;

        case 'chat':
          navigate(createPageUrl('Chat'));
          break;

        case 'payment':
        case 'abrechnung':
          navigate(createPageUrl('Abrechnung'));
          break;

        case 'profile':
        case 'profil':
          navigate(createPageUrl('Profil'));
          break;

        case 'document':
          navigate(createPageUrl('Dokumente'));
          break;

        case 'fuel':
          navigate(createPageUrl('DriverHome'));
          break;

        case 'notifications':
          navigate(createPageUrl('Notifications'));
          break;

        case 'reset-password':
        case 'resetpassword':
          const token = queryParams.get('token');
          const email = queryParams.get('email');
          if (token && email) {
            navigate(createPageUrl('ResetPassword') + `?token=${token}&email=${email}`);
          } else {
            navigate(createPageUrl('ResetPassword'));
          }
          break;

        case 'login':
          navigate(createPageUrl('Anmelden'));
          break;

        default:
          navigate(createPageUrl('Dashboard'));
      }

    } catch (error) {
      console.error('❌ Deep Link Fehler:', error);
      navigate(createPageUrl('Dashboard'));
    }
  };

  return { handleDeepLinkURL };
}

// Komponente für Auto-Init
export default function DeepLinkHandler() {
  useDeepLinks();
  return null;
}