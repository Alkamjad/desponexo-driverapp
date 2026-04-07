import { useState, useEffect, useCallback } from 'react';
import supabase from '@/components/supabaseClient';

/**
 * Hook für Realtime Tour-Updates mit Supabase (Driver App)
 * Updates kommen in <200ms an statt mehrere Sekunden Verzögerung
 * Fallback: Smart Polling wenn Realtime-Connection fehlschlägt
 */
export const useMyToursRealtime = (driverId) => {
  const [tours, setTours] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');

  const enhanceTour = useCallback((tour) => {
    const tourDate = tour.scheduled_pickup_from ? tour.scheduled_pickup_from.split('T')[0] : null;
    let displayStatus = tour.status;
    let statusMessage = '';

    if (tour.status === 'arrived_at_customer') {
      displayStatus = 'arrived_at_customer';
      statusMessage = '📍 Beim Kunden';
    } else if (tour.status === 'delivered' && !tour.approved_at) {
      displayStatus = 'awaiting_approval';
      statusMessage = '⏳ Wartet auf Abrechnung';
    } else if (tour.status === 'completed' && tour.approved_at) {
      displayStatus = 'approved';
      statusMessage = '✅ Genehmigt';
    }

    return { ...tour, tour_date: tourDate, displayStatus, statusMessage };
  }, []);

  const loadInitialTours = useCallback(async () => {
    if (!driverId) return;

    try {
      setIsLoading(true);

      const { data, error: queryError } = await supabase
        .from('tours')
        .select(`
          id,
          tour_id,
          driver_id,
          status,
          assigned_at,
          started_at,
          delivered_at,
          scheduled_pickup_from,
          scheduled_pickup_to,
          scheduled_delivery_from,
          scheduled_delivery_to,
          tour_title,
          customer_name,
          client_name,
          pickup_address,
          delivery_address,
          destination_address,
          stops,
          approved_at,
          is_multi_stop,
          final_compensation
        `)
        .eq('driver_id', driverId)
        .order('assigned_at', { ascending: false })
        .limit(100);

      if (queryError) throw queryError;

      const enhancedTours = (data || []).map(enhanceTour);
      setTours(enhancedTours);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [driverId, enhanceTour]);

  useEffect(() => {
    if (!driverId) {
      setIsLoading(false);
      return;
    }

    loadInitialTours();

    const channelName = `driver_tours_${driverId}`;
    let pollingInterval = null;
    let channel = null;

    const setupRealtime = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          await supabase.realtime.setAuth(sessionData.session.access_token);
        }
      } catch (e) {
        console.warn('[useMyToursRealtime] Auth-Token fehlgeschlagen:', e);
      }

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'tours', filter: `driver_id=eq.${driverId}` },
          (payload) => {
            const enhanced = enhanceTour(payload.new);
            setTours(function(prev) {
              if (prev.some(function(t) { return t.id === enhanced.id; })) return prev;
              return [enhanced].concat(prev);
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'tours', filter: `driver_id=eq.${driverId}` },
          (payload) => {
            console.log('[useMyToursRealtime] UPDATE event received:', { id: payload.new.id, status: payload.new.status });

            // Wenn nur wenige Felder im payload → einfach komplett neu laden
            // Supabase Realtime ohne REPLICA IDENTITY FULL liefert nur geänderte Spalten
            const payloadKeys = Object.keys(payload.new || {});
            if (payloadKeys.length < 5) {
              console.log('[useMyToursRealtime] Partial payload detected, reloading all tours');
              loadInitialTours();
              return;
            }

            setTours(function(prev) {
              var exists = prev.some(function(t) {
                return t.id === payload.new.id || t.tour_id === payload.new.tour_id;
              });

              if (exists) {
                return prev.map(function(t) {
                  if (t.id === payload.new.id || t.tour_id === payload.new.tour_id) {
                    var merged = Object.assign({}, t, payload.new);
                    return enhanceTour(merged);
                  }
                  return t;
                });
              }
              return [enhanceTour(payload.new)].concat(prev);
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'tours', filter: `driver_id=eq.${driverId}` },
          (payload) => {
            setTours(function(prev) {
              return prev.filter(function(t) {
                return t.id !== payload.old.id && t.tour_id !== payload.old.tour_id;
              });
            });
          }
        )
        .subscribe(function(status) {
          console.log('[useMyToursRealtime] Realtime status:', status);
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('connected');
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            setRealtimeStatus('disconnected');
            if (!pollingInterval) {
              pollingInterval = setInterval(function() {
                loadInitialTours();
              }, 10000);
            }
          }
        });
    };

    setupRealtime();

    return function() {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (channel) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      }
    };
  }, [driverId, loadInitialTours, enhanceTour]);

  return {
    data: tours,
    isLoading,
    error,
    realtimeStatus,
    refetch: loadInitialTours
  };
};