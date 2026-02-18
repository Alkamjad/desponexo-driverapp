import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, Package, Euro, Clock, CheckCircle2, 
  RefreshCw, LogOut, Loader2, Calendar, FileText, MessageCircle, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { authClient } from "@/components/authClient";
import OnboardingTutorial from "@/components/OnboardingTutorial";
import { t } from "@/components/utils/i18n";
import LoadingScreen from "@/components/LoadingScreen";
import DriverAnalytics from "@/components/DriverAnalytics";
import PushNotificationManager from "@/components/PushNotificationManager";
import { offlineManager } from "@/components/OfflineManager";
import { useOfflineStatus } from "@/components/hooks/useOfflineStatus";
import SyncManager from "@/components/SyncManager";
import ConnectionStatus from "@/components/ConnectionStatus";
import NotificationBell from "@/components/NotificationBell";

import AbsenceOverlay from "@/components/AbsenceOverlay";
import { useScrollRestoration } from "@/components/hooks/useScrollRestoration";

export default function Dashboard() {
  const navigate = useNavigate();
  const { supabase, driver, driverId, logout } = useAuth();
  const [tours, setTours] = useState([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAbsenceOverlay, setShowAbsenceOverlay] = useState(true);
  const isOnline = useOfflineStatus();
  const driverEmail = driver?.email;
  const scrollRef = useScrollRestoration('Dashboard');
  
  // Benachrichtigungs-Glocke entfernt

  // Push Notifications Permission anfragen
  const requestPushPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  // Tour Realtime Subscription - sofortige Updates bei Änderungen aus der Hauptapp
  useEffect(() => {
    if (!driverId) return;

    let tourChannel = null;

    const setupTourRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      const enhanceTour = (tour) => {
        let displayStatus = tour.status;
        let statusMessage = '';
        if (tour.status === 'delivered' && !tour.approved_at) {
          displayStatus = 'awaiting_approval';
          statusMessage = '⏳ Wartet auf Abrechnung';
        } else if (tour.status === 'completed' && tour.approved_at) {
          displayStatus = 'approved';
          statusMessage = '✅ Genehmigt';
        }
        const tourDate = tour.scheduled_pickup_from ? tour.scheduled_pickup_from.split('T')[0] : null;
        return { ...tour, tour_date: tourDate, displayStatus, statusMessage };
      };

      tourChannel = supabase
        .channel(`dashboard_tours_${driverId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'tours', filter: `driver_id=eq.${driverId}` },
          (payload) => {
            const enhanced = enhanceTour(payload.new);
            setTours(prev => prev.some(t => t.id === enhanced.id) ? prev : [enhanced, ...prev]);
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'tours' },
          (payload) => {
            if (payload.new.driver_id !== driverId) return;
            const enhanced = enhanceTour(payload.new);
            setTours(prev => {
              const exists = prev.some(t => t.id === enhanced.id || t.tour_id === enhanced.tour_id);
              if (exists) {
                return prev.map(t => (t.id === enhanced.id || t.tour_id === enhanced.tour_id) ? enhanced : t);
              }
              return [enhanced, ...prev];
            });
          }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'tours', filter: `driver_id=eq.${driverId}` },
          (payload) => {
            setTours(prev => prev.filter(t => t.id !== payload.old.id));
          }
        )
        .subscribe((status) => {
          console.log('[Dashboard] Tour realtime:', status);
        });
    };

    setupTourRealtime();
    return () => { if (tourChannel) supabase.removeChannel(tourChannel); };
  }, [driverId, supabase]);

  // Chat Realtime Subscription separat (damit Cleanup korrekt funktioniert)
  useEffect(() => {
    const driverData = JSON.parse(localStorage.getItem("driver_data") || "{}");
    if (!driverData.company_id) return;

    let chatChannel = null;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      chatChannel = supabase
        .channel('dashboard_chat_badge')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `company_id=eq.${driverData.company_id}` },
          (payload) => {
            const msg = payload.new;
            if (msg.sender_type === 'company' && !msg.is_read) {
              setUnreadChatCount(prev => prev + 1);
            }
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `company_id=eq.${driverData.company_id}` },
          (payload) => {
            const msg = payload.new;
            const oldMsg = payload.old;
            if (msg.sender_type === 'company' && msg.is_read && !oldMsg.is_read) {
              setUnreadChatCount(prev => Math.max(0, prev - 1));
            }
          }
        )
        .subscribe((status) => {
          console.log('[Dashboard] Chat realtime:', status);
        });
    };

    setup();
    return () => { if (chatChannel) supabase.removeChannel(chatChannel); };
  }, []);

  useEffect(() => {
    checkAuthAndLoadData();

    // Tutorial beim ersten Login
    const tutorialCompleted = localStorage.getItem('tutorial_completed');
    if (!tutorialCompleted) {
      setShowTutorial(true);
    }

    // Push Notifications Permission anfragen NACH Login
    requestPushPermission();

    // Chat-Count beim Load aktualisieren
    const driverData = JSON.parse(localStorage.getItem("driver_data") || "{}");
    if (driverData.email && driverData.company_id) {
      loadUnreadChatCount(driverData.email, driverData.company_id);
    }
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      if (!driverId && navigator.onLine) {
        navigate(createPageUrl('Anmelden'));
        return;
      }
      
      // Lade Touren-Daten
      await loadData();
    } catch (error) {
      if (navigator.onLine) {
        navigate(createPageUrl('Anmelden'));
      }
    }
  };

  const loadData = async (showRefresh = false) => {
    if (!driverId) {
      navigate(createPageUrl('Anmelden'));
      return;
    }

    if (showRefresh) setIsRefreshing(true);

    try {

        // ✅ Direkte Supabase Query - Touren FÜR DIESEN FAHRER
        const { data: toursData, error: toursError } = await supabase
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
            stops,
            approved_at,
            is_multi_stop,
            final_compensation
          `)
          .eq('driver_id', driverId)
          .order('assigned_at', { ascending: false })
          .limit(100);

        if (!toursError) {
          // Status-Interpretation erweitern
          const enhancedTours = (toursData || []).map(tour => {
            let displayStatus = tour.status;
            let statusMessage = '';

            if (tour.status === 'delivered' && !tour.approved_at) {
              displayStatus = 'awaiting_approval';
              statusMessage = '⏳ Wartet auf Abrechnung';
            } else if (tour.status === 'completed' && tour.approved_at) {
              displayStatus = 'approved';
              statusMessage = '✅ Genehmigt';
            }

            const tourDate = tour.scheduled_pickup_from ? tour.scheduled_pickup_from.split('T')[0] : null;

            return {
              ...tour,
              tour_date: tourDate,
              displayStatus,
              statusMessage
            };
          });

          setTours(enhancedTours);

          // Offline-Caching für aktive Touren
          try {
            const activeTours = enhancedTours.filter(t => {
              const status = t.status?.toLowerCase();
              const completedStatuses = ['completed', 'delivered', 'erfolgreich', 'abgeschlossen', 'cancelled', 'canceled', 'storniert'];
              return !completedStatuses.includes(status);
            });
            await offlineManager.saveTours(activeTours, true);
          } catch (cacheError) {
            // Fehler beim Auto-Speichern
          }
          }

        // Chat-Count laden
        if (driver?.email && driver?.company_id) {
          loadUnreadChatCount(driver.email, driver.company_id);
        }

    } catch (error) {
       toast.error(t('dashboard_error'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadUnreadChatCount = async (email, companyId) => {
    try {
      const { count, error } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('sender_type', 'company')
        .eq('is_read', false);

      if (!error) {
        setUnreadChatCount(count || 0);
      }
    } catch (error) {
      // Error loading unread chat count
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success(t('dashboard_logout_success'));
    navigate(createPageUrl('Anmelden'));
  };

  if (isLoading) {
    return <LoadingScreen message={t('dashboard_loading')} />;
  }

  // Statistiken berechnen
  const aktiveTours = tours.filter(t => {
    const status = t.status?.toLowerCase();
    // Schließe gebrochene, stornierte, abgelehnte Touren aus
    const inactiveStatus = ['cancelled', 'canceled', 'broken', 'gebrochen', 'rejected', 'abgelehnt', 'completed', 'delivered', 'erfolgreich', 'abgeschlossen'];
    return status && !inactiveStatus.includes(status);
  });
  const erledigteTours = tours.filter(t => 
    ['completed', 'delivered', 'erfolgreich', 'abgeschlossen'].includes(t.status?.toLowerCase())
  );

  const handleSyncComplete = (syncedTours) => {
    setTours(syncedTours);
  };

  return (
    <div className="min-h-screen pb-24 overflow-x-hidden overflow-y-auto" ref={scrollRef}>
      {/* Connection Status Banner */}
      <ConnectionStatus isOnline={isOnline} />

      {/* Sync Manager */}
      {driverId && (
        <SyncManager 
          driverId={driverId} 
          isOnline={isOnline} 
          onSyncComplete={handleSyncComplete}
        />
      )}

      {/* Push-Benachrichtigungen Manager */}
      <PushNotificationManager driverId={driverId} />
      
      {/* Absence Overlay */}
      {showAbsenceOverlay && driverId && driverEmail && (
        <AbsenceOverlay 
          driverId={driverId} 
          driverEmail={driverEmail}
          onClose={() => setShowAbsenceOverlay(false)}
        />
      )}
      
      {/* Onboarding Tutorial */}
      {showTutorial && <OnboardingTutorial onComplete={() => setShowTutorial(false)} />}
      
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-b-3xl p-4 sm:p-6 pt-safe mb-6 shadow-xl" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Truck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {t('dashboard_hello')}, {driver?.first_name || driver?.vorname || t('nav_profile')}!
              </h1>
              <p className="text-emerald-100 text-sm">
                {driver?.company_name || 'DespoNexo Driver'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="text-white hover:bg-white/20"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-white hover:bg-white/20"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        
      </div>

      <div className="px-4 sm:px-6 space-y-6">
        {/* Statistik-Karten */}
         <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{aktiveTours.length}</div>
              <div className="text-sm text-blue-100">{t('dashboard_active_tours')}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 border-0 shadow-lg">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{erledigteTours.length}</div>
              <div className="text-sm text-green-100">{t('dashboard_completed')}</div>
            </CardContent>
          </Card>


        </div>

        {/* Weitere Funktionen */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
            <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{t('dashboard_more_functions')}</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => navigate(createPageUrl('Chat'))}
              className="relative group cursor-pointer"
            >
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10 border border-emerald-500/20 rounded-2xl p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/10">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="relative w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                    <MessageCircle className="w-7 h-7 text-emerald-400" />
                    {unreadChatCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg">
                        {unreadChatCount > 9 ? '9+' : unreadChatCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t('dashboard_chat_title')}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{t('dashboard_chat_desc')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              onClick={() => navigate(createPageUrl('Dokumente'))}
              className="relative group cursor-pointer"
            >
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10 border border-blue-500/20 rounded-2xl p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/10">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                    <FileText className="w-7 h-7 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t('dashboard_docs_title')}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{t('dashboard_docs_desc')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              onClick={() => navigate(createPageUrl('Abwesenheit'))}
              className="relative group cursor-pointer"
            >
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 hover:from-purple-500/20 hover:to-purple-600/10 border border-purple-500/20 rounded-2xl p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/10">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                    <Calendar className="w-7 h-7 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t('dashboard_absence_title')}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{t('dashboard_absence_desc')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              onClick={() => navigate(createPageUrl('Ordnungswidrigkeiten'))}
              className="relative group cursor-pointer"
            >
              <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 hover:from-red-500/20 hover:to-red-600/10 border border-red-500/20 rounded-2xl p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/10">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                    <AlertTriangle className="w-7 h-7 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t('dashboard_violations')}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{t('dashboard_violations_desc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div
              onClick={() => navigate(createPageUrl('Leistungsanalyse'))}
              className="relative group cursor-pointer w-full max-w-[calc(50%-0.375rem)]"
            >
              <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10 border border-amber-500/20 rounded-2xl p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-amber-500/10">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                    <FileText className="w-7 h-7 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t('dashboard_analytics_title')}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{t('dashboard_analytics_desc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>



      </div>
    </div>
  );
}