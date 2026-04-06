import React, { useEffect, useState, useCallback, useRef, useSyncExternalStore } from 'react';
import supabase from '@/components/supabaseClient';
import { t } from '@/components/utils/i18n';
import { useAuth } from '@/components/AuthContext';

/**
 * NOTIFICATION HUB v4
 * Zentraler Singleton-Store für Notifications.
 * Nur NotificationHub startet Realtime-Subscriptions (1x).
 * Alle Consumer (Bell, Seite) lesen über useNotifications() den globalen State.
 */

// ===== GLOBALER STORE (Singleton) =====
let globalNotifications = [];
let globalUnreadCount = 0;
let globalIsLoading = true;
const listeners = new Set();
const shownBannerIds = new Set();

function emitChange() {
  listeners.forEach(fn => fn());
}

function getSnapshot() {
  return { notifications: globalNotifications, unreadCount: globalUnreadCount, isLoading: globalIsLoading };
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Globale Setter
function setGlobalNotifications(updater) {
  if (typeof updater === 'function') {
    globalNotifications = updater(globalNotifications);
  } else {
    globalNotifications = updater;
  }
  globalUnreadCount = globalNotifications.filter(n => !n.read).length;
  emitChange();
}

function setGlobalLoading(val) {
  globalIsLoading = val;
  emitChange();
}

// ===== HOOK für Consumer =====
export const useNotifications = () => {
  const [, forceUpdate] = useState(0);
  
  useEffect(() => {
    const unsub = subscribe(() => forceUpdate(c => c + 1));
    return unsub;
  }, []);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await supabase
        .from('driver_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      setGlobalNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));

      setTimeout(async () => {
        try {
          await supabase.from('driver_notifications').delete().eq('id', notificationId);
          setGlobalNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (_) {}
      }, 20000);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async (driverId) => {
    const nowIso = new Date().toISOString();
    const unreadIds = globalNotifications.filter(n => !n.read).map(n => n.id);

    setGlobalNotifications(prev => prev.map(n => n.read ? n : ({ ...n, read: true, read_at: nowIso })));

    try {
      if (driverId) {
        await supabase
          .from('driver_notifications')
          .update({ read: true, read_at: nowIso })
          .eq('driver_id', driverId)
          .eq('read', false);
      }

      if (unreadIds.length > 0) {
        setTimeout(async () => {
          try { await supabase.from('driver_notifications').delete().in('id', unreadIds); } catch (_) {}
        }, 20000);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, []);

  return {
    notifications: globalNotifications,
    unreadCount: globalUnreadCount,
    isLoading: globalIsLoading,
    markAsRead,
    markAllAsRead
  };
};

// ===== SINGLETON ENGINE (nur 1x im Layout) =====
let engineRunning = false;

export default function NotificationHub() {
  const { driver, user } = useAuth();
  const channelsRef = useRef([]);
  const isInitialLoadDoneRef = useRef(false);
  const notificationsRef = useRef(globalNotifications);

  // Sync ref mit globalem State
  useEffect(() => {
    const unsub = subscribe(() => {
      notificationsRef.current = globalNotifications;
    });
    return unsub;
  }, []);

  const driverIdRef = useRef(driver?.id || (typeof window !== 'undefined' ? localStorage.getItem('driver_id') : null));
  const driverEmailRef = useRef(driver?.email || (typeof window !== 'undefined' ? localStorage.getItem('driver_email') : null));

  useEffect(() => {
    driverIdRef.current = driver?.id || localStorage.getItem('driver_id');
    driverEmailRef.current = driver?.email || localStorage.getItem('driver_email');
  }, [driver]);

  const driverId = driverIdRef.current;
  const driverEmail = driverEmailRef.current;

  // saveNotification - stable callback
  const saveNotification = useCallback(async (type, title, message, sourceData) => {
    if (!driverIdRef.current || !isInitialLoadDoneRef.current) return;

    const getSourceId = (obj) => obj?.id || obj?.tour_id || obj?.payment_id || obj?.report_id || obj?.message_id || obj?.absence_request_id;
    const alreadyExists = notificationsRef.current.some(n =>
      n.type === type && getSourceId(n.source_data) === getSourceId(sourceData)
    );
    if (alreadyExists) return;

    const notificationHash = `${type}-${sourceData?.id || JSON.stringify(sourceData)}`;

    try {
      const API_BASE_URL = window.location.origin;
      await fetch(`${API_BASE_URL}/functions/saveNotification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverIdRef.current,
          driver_email: driverEmailRef.current,
          type, title, message,
          source_data: sourceData,
          notification_hash: notificationHash
        })
      });
    } catch (error) {
      console.error('Error saving notification:', error);
    }
  }, []);

  // === MASTER EFFECT: Load + Realtime + Producers ===
  useEffect(() => {
    if (!user || !driverIdRef.current || engineRunning) return;
    engineRunning = true;

    const allChannels = [];
    const currentDriverId = driverIdRef.current;
    const currentDriverEmail = driverEmailRef.current;

    const init = async () => {
      // 1. Auth-Token für Realtime setzen
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      } else {
        console.warn('[NotificationHub] Keine Auth-Session für Realtime');
      }

      // 2. Initiale Notifications laden
      try {
        const { data, error } = await supabase
          .from('driver_notifications')
          .select('*')
          .eq('driver_id', currentDriverId)
          .eq('read', false)
          .order('created_at', { ascending: false });

        if (!error && data) {
          data.forEach(n => shownBannerIds.add(n.id));
          setGlobalNotifications(data);
        }
      } catch (err) {
        console.error('Error loading notifications:', err);
      }
      setGlobalLoading(false);
      isInitialLoadDoneRef.current = true;

      // 3. Realtime für driver_notifications INSERT
      const notifChannel = supabase
        .channel(`notif_master_${currentDriverId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'driver_notifications', filter: `driver_id=eq.${currentDriverId}` },
          (payload) => {
            const notification = payload.new;
            if (!notification) return;

            setGlobalNotifications(prev => {
              if (prev.some(n => n.id === notification.id)) return prev;

              // In-App Banner (einmalig)
              if (!shownBannerIds.has(notification.id)) {
                shownBannerIds.add(notification.id);
                try {
                  window.dispatchEvent(new CustomEvent('in-app-notification', { detail: notification }));
                } catch (_) {}
              }

              return [notification, ...prev];
            });
          }
        )
        .subscribe((status) => {
          console.log('[NotificationHub] Notif-Realtime:', status);
        });
      allChannels.push(notifChannel);

      // 4. Producers - nach 3s Events aktivieren
      let isEventsReady = false;
      const initialIds = { tours: new Set(), payments: new Set(), chat: new Set(), fuel: new Set(), docs: new Set(), violations: new Set() };
      setTimeout(() => { isEventsReady = true; }, 3000);

      let company_id = null;
      try {
        const dd = localStorage.getItem('driver_data');
        if (dd) company_id = JSON.parse(dd).company_id;
      } catch (_) {}

      // Tours
      const tourCh = supabase
        .channel(`prod_tours_${currentDriverId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tours', filter: `driver_id=eq.${currentDriverId}` },
          (payload) => {
            const { eventType, new: tour, old: oldTour } = payload;
            if (eventType === 'INSERT') {
              if (!isEventsReady) { initialIds.tours.add(tour.id); return; }
              if (!initialIds.tours.has(tour.id)) {
                saveNotification('tour', 'Neue Tour zugewiesen', tour.pickup_address || tour.tour_title || 'Neue Tour', tour);
              }
            } else if (eventType === 'UPDATE' && isEventsReady) {
              const cancelled = ['cancelled', 'canceled', 'storniert', 'abgebrochen', 'abgesagt'];
              if (cancelled.includes(tour.status?.toLowerCase())) {
                saveNotification('tour_cancelled', 'Tour storniert', tour.pickup_address || 'Tour', tour);
              }
              if (tour.approved_at && !oldTour?.approved_at) {
                saveNotification('tour_approved', 'Tour genehmigt', tour.pickup_address || 'Tour', tour);
              }
            }
          }
        ).subscribe();
      allChannels.push(tourCh);

      // Payments
      const payCh = supabase
        .channel(`prod_pay_${currentDriverId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_payments', filter: `driver_email=eq.${currentDriverEmail}` },
          (payload) => {
            const p = payload.new;
            if (!isEventsReady) { initialIds.payments.add(p.id); return; }
            if (!initialIds.payments.has(p.id)) saveNotification('payment', 'Neue Zahlung', `${p.amount || 0}€`, p);
          }
        ).subscribe();
      allChannels.push(payCh);

      // Chat
      if (company_id && currentDriverEmail) {
        const chatCh = supabase
          .channel(`prod_chat_${company_id}_${currentDriverId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `company_id=eq.${company_id}` },
            (payload) => {
              const m = payload.new;
              if (m.sender_type === 'company') {
                if (!isEventsReady) { initialIds.chat.add(m.id); return; }
                if (!initialIds.chat.has(m.id)) saveNotification('chat', 'Neue Nachricht', m.message?.substring(0, 50) || 'Neue Nachricht', m);
              }
            }
          ).subscribe();
        allChannels.push(chatCh);
      }

      // Fuel Reports
      const fuelCh = supabase
        .channel(`prod_fuel_${currentDriverId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fuel_reports', filter: `driver_email=eq.${currentDriverEmail}` },
          (payload) => {
            const { eventType, new: r } = payload;
            if (eventType === 'INSERT') {
              if (!isEventsReady) { initialIds.fuel.add(r.id); return; }
              if (!initialIds.fuel.has(r.id)) saveNotification('fuel', 'Neuer Tankbericht', `${r.liters || 0}L - ${r.amount || 0}€`, r);
            } else if (eventType === 'UPDATE' && isEventsReady && r.approved_at) {
              saveNotification('fuel_approved', 'Tankbeleg genehmigt', `${r.liters || 0}L - ${r.amount || 0}€`, r);
            }
          }
        ).subscribe();
      allChannels.push(fuelCh);

      // Documents
      const docCh = supabase
        .channel(`prod_docs_${currentDriverId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_documents', filter: `driver_email=eq.${currentDriverEmail}` },
          (payload) => {
            const d = payload.new;
            if (!isEventsReady) { initialIds.docs.add(d.id); return; }
            if (!initialIds.docs.has(d.id)) saveNotification('document', 'Neues Dokument', d.document_name || d.file_name || 'Neues Dokument', d);
          }
        ).subscribe();
      allChannels.push(docCh);

      // Violations
      const violCh = supabase
        .channel(`prod_viol_${currentDriverId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'traffic_violations', filter: `driver_email=eq.${currentDriverEmail}` },
          (payload) => {
            const v = payload.new;
            if (!isEventsReady) { initialIds.violations.add(v.id); return; }
            if (!initialIds.violations.has(v.id)) {
              const labels = { SPEEDING: 'Geschwindigkeitsüberschreitung', RED_LIGHT: 'Rotlichtverstoß', PARKING: 'Parkverstoß', PHONE: 'Handyverstoß', DISTANCE: 'Abstandsverstoß', OTHER: 'Sonstiges' };
              saveNotification('violation', t('notif_new_violation'), `${v.amount?.toFixed(2)}€ - ${labels[v.violation_type] || v.violation_type}`, v);
            }
          }
        ).subscribe();
      allChannels.push(violCh);

      channelsRef.current = allChannels;
    };

    init();

    return () => {
      engineRunning = false;
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [user, saveNotification]);

  return null;
}