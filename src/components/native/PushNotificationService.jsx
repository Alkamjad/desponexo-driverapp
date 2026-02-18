import { useEffect, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { App as CapacitorApp } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Capacitor } from '@capacitor/core';

/**
 * PUSH NOTIFICATION SERVICE - Zentrale Verwaltung
 * 
 * Funktionen:
 * 1. Push Notifications registrieren
 * 2. Token speichern (für Backend)
 * 3. Notifications empfangen & verarbeiten
 * 4. Deep Links zu Seiten
 */

export function usePushNotifications() {
  const [token, setToken] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Nur auf nativen Plattformen (iOS/Android)
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    initializePushNotifications();
  }, []);

  const initializePushNotifications = async () => {
    try {
      // 1. PERMISSION PRÜFEN
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        // Noch nicht gefragt → User fragen
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        return;
      }

      // 2. REGISTRIERUNG
      await PushNotifications.register();

      // 3. EVENT LISTENER

      // Token erhalten (zum Backend senden)
      PushNotifications.addListener('registration', (tokenData) => {
        setToken(tokenData.value);
        setIsRegistered(true);
        saveTokenToBackend(tokenData.value);
      });

      // Fehler bei Registrierung
      PushNotifications.addListener('registrationError', () => {});

      // Notification EMPFANGEN (App ist offen)
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        showLocalNotification(notification);
      });

      // Notification GEÖFFNET (User hat drauf getippt)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data;
        handleDeepLink(data);
      });

    } catch (error) {}
  };

  // Token zum Backend senden (via Backend Function)
  const saveTokenToBackend = async (fcmToken) => {
    try {
      const { callFunction } = await import('@/components/utils/callFunction');

      await callFunction('updateFcmToken', {
        fcm_token: fcmToken,
        fcm_platform: Capacitor.getPlatform()
      });
    } catch (error) {}
  };

  // Deep Link Handler
  const handleDeepLink = async (data) => {
    if (!data) return;

    // Markiere Notification als gelesen (Supabase RLS)
    if (data.notification_id) {
      try {
        const { default: supabase } = await import('@/components/supabaseClient');
        
        await supabase
          .from('driver_notifications')
          .update({ 
            read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', data.notification_id);
      } catch (error) {}
    }

    // Deep Link Navigation basierend auf Typ
    if (data.type === 'tour' || data.type === 'tour_cancelled' || data.type === 'tour_approved') {
      if (data.tour_id || data.id) {
        navigate(createPageUrl('TourDetails') + `?id=${data.tour_id || data.id}`);
      } else {
        navigate(createPageUrl('DriverHome'));
      }
      return;
    }

    if (data.type === 'chat') {
      navigate(createPageUrl('Chat'));
      return;
    }

    if (data.type === 'payment') {
      navigate(createPageUrl('Abrechnung'));
      return;
    }

    if (data.type === 'fuel' || data.type === 'fuel_approved') {
      navigate(createPageUrl('DriverHome'));
      return;
    }

    if (data.type === 'document') {
      navigate(createPageUrl('Dokumente'));
      return;
    }

    if (data.type === 'absence_request_created' || data.type === 'absence_request_approved' || data.type === 'absence_request_rejected') {
      navigate(createPageUrl('Abwesenheit'));
      return;
    }

    // Route aus Notification Data
    if (data.route) {
      navigate(data.route);
      return;
    }

    // Tour ID (legacy)
    if (data.tour_id) {
      navigate(createPageUrl('TourDetails') + `?id=${data.tour_id}`);
      return;
    }

    // Chat öffnen (legacy)
    if (data.open_chat) {
      navigate(createPageUrl('Chat'));
      return;
    }

    // Payment/Abrechnung (legacy)
    if (data.open_payment) {
      navigate(createPageUrl('Abrechnung'));
      return;
    }

    // Standard: Dashboard
    navigate(createPageUrl('Dashboard'));
  };

  // Lokale Notification anzeigen (wenn App offen ist)
  const showLocalNotification = (notification) => {
    // Browser Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title || 'Neue Nachricht', {
        body: notification.body,
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%2310b981" width="100" height="100"/%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%2310b981" width="100" height="100"/%3E%3C/svg%3E',
        tag: notification.data?.tag || 'default',
        requireInteraction: false
      });
    }
  };

  return {
    token,
    isRegistered,
    handleDeepLink
  };
}

// Komponente für Auto-Init
export default function PushNotificationService() {
  usePushNotifications();
  return null; // Unsichtbare Service-Komponente
}