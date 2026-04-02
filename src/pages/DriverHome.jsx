import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, CheckCircle2, Loader2, RefreshCw, Inbox, XCircle, Search, X, Calendar
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/components/utils/i18n";
import moment from "moment";
import TourActionCard from "@/components/driver/TourActionCard";
import ActiveMultiStop from "@/components/driver/ActiveMultiStop";
import LoadingScreen from "@/components/LoadingScreen";
import { useOfflineStatus } from "@/components/hooks/useOfflineStatus";
import { useMyToursRealtime } from "@/components/hooks/useMyToursRealtime";
import ConnectionStatus from "@/components/ConnectionStatus";
import SyncManager from "@/components/SyncManager";
import { useScrollRestoration } from "@/components/hooks/useScrollRestoration";
import { useTabStateRestoration } from "@/components/hooks/useTabStateRestoration";
import { useAuth } from "@/components/AuthContext";

// Safe Map Utility (direkt in der Datei, falls du safeMap.js nicht hast)
const safeMap = (array, callback) => {
  if (!array || !Array.isArray(array) || array.length === 0) {
    return [];
  }
  
  return array.map((item, index) => {
    if (!item) return null;
    
    try {
      return callback(item, index);
    } catch {
      return null;
    }
  }).filter(item => item !== null);
};

const getSafeKey = (item, index, fallbackPrefix = 'item') => {
  if (!item) return `${fallbackPrefix}-${index}`;
  
  // Versuche verschiedene ID-Felder
  const key = item.id || 
              item._id || 
              item.uuid || 
              item.key || 
              item.tour_id || 
              `${fallbackPrefix}-${index}`;
  
  return key;
};

export default function DriverHome() {
  const navigate = useNavigate();
  const { driverId } = useAuth();
  const { data: tours, isLoading, refetch: reloadTours } = useMyToursRealtime(driverId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("aktiv");
  const [futureTours, setFutureTours] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const isOnline = useOfflineStatus();
  const scrollRef = useScrollRestoration('DriverHome');
  useTabStateRestoration('DriverHome', activeTab, setActiveTab);

  // Prüfe ob driverId existiert
  useEffect(() => {
    if (!driverId && navigator.onLine) {
      navigate(createPageUrl('Anmelden'));
    }
  }, [driverId, navigate]);

  const handleStatusUpdate = (updatedTour) => {
    // KRITISCH: Prüfe ob updatedTour valide ist
    if (!updatedTour || !updatedTour.id) {
      reloadTours(); // Fallback: Alle Touren neu laden
      return;
    }
    
    // 🚀 SOFORT lokal aktualisieren - nicht auf Realtime warten!
    const updatedTours = tours.map(t => t.id === updatedTour.id ? updatedTour : t);
    // Nutze die Query aus useMyToursRealtime um lokal zu aktualisieren
    reloadTours(); // Aber auch im Hintergrund neu laden für Sicherheit
  };

  // Nur heutige Touren im "aktiv" Tab - EUROPÄISCHE ZEIT
  const today = moment().format('YYYY-MM-DD');

  const aktiveTours = tours.filter(t => {
    // Sicherheitsprüfung
    if (!t) return false;
    
    const status = t.status?.toLowerCase();
    const displayStatus = t.displayStatus?.toLowerCase();
    const inactiveStatus = ['cancelled', 'canceled', 'broken', 'gebrochen', 'rejected', 'abgelehnt'];

    // Completed Touren ausblenden
    if (status === 'completed') {
      return false;
    }

    // Status-Check
    const isActiveStatus = displayStatus === 'awaiting_approval' || 
      (status && !inactiveStatus.includes(status) && status !== 'completed' && status !== 'approved');

    if (!isActiveStatus) {
      return false;
    }

    // 🔥 KRITISCH: Touren die bereits bestätigt/abgeholt wurden IMMER anzeigen (unabhängig vom Datum)
    const isInProgress = ['confirmed', 'picked_up', 'in_transit', 'delivered'].includes(status);
    if (isInProgress) {
      return true; // Zeige immer, egal ob Datum in Vergangenheit liegt
    }

    // Datum-Check NUR für "assigned" Status: Nur heutige Touren
    const tourDate = t.scheduled_pickup_from ? t.scheduled_pickup_from.split('T')[0] : null;
    if (!tourDate) return false;
    
    const isToday = tourDate === today;
    return isToday;
  });

  // Zukünftige Touren
  React.useEffect(() => {
    const future = tours.filter(t => {
      if (!t) return false;
      
      const status = t.status?.toLowerCase();

      const inactiveStatus = ['cancelled', 'canceled', 'broken', 'gebrochen', 'rejected', 'abgelehnt', 'completed', 'approved'];
      if (inactiveStatus.includes(status)) return false;

      const tourDate = t.scheduled_pickup_from ? t.scheduled_pickup_from.split('T')[0] : null;
      if (!tourDate) return false;
      
      return tourDate > today;
    });
    setFutureTours(future);
  }, [tours]);
  
  // Abgebrochene Touren
  const abgebrocheneTours = tours.filter(t => {
    if (!t) return false;
    return ['cancelled', 'canceled', 'broken', 'gebrochen', 'rejected', 'abgelehnt'].includes(t.status?.toLowerCase())
  });
  
  // Erledigte Touren mit Filter
  const erledigteTours = tours.filter(t => {
    if (!t) return false;
    const status = t.status?.toLowerCase();
    const displayStatus = t.displayStatus?.toLowerCase();
    const isCompleted = status === 'completed' || status === 'approved' || displayStatus === 'approved';
    
    if (!isCompleted) return false;

    // Nur filtern wenn im "erledigt" Tab
    if (activeTab !== "erledigt") return true;

    // Text-Suche
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      t.tour_id?.toLowerCase().includes(searchLower) ||
      t.customer_name?.toLowerCase().includes(searchLower) ||
      t.client_name?.toLowerCase().includes(searchLower) ||
      t.tour_title?.toLowerCase().includes(searchLower) ||
      t.pickup_address?.toLowerCase().includes(searchLower) ||
      t.delivery_address?.toLowerCase().includes(searchLower);

    // Datum-Filter
    const tourDate = t.tour_date || (t.scheduled_pickup_from ? t.scheduled_pickup_from.split('T')[0] : null);
    const matchesDateFrom = !dateFrom || (tourDate && moment(tourDate).isSameOrAfter(dateFrom, 'day'));
    const matchesDateTo = !dateTo || (tourDate && moment(tourDate).isSameOrBefore(dateTo, 'day'));

    return matchesSearch && matchesDateFrom && matchesDateTo;
  });



  const handleSyncComplete = () => {
    reloadTours();
  };

  if (isLoading) {
    return <LoadingScreen message={t('tours_loading')} />;
  }

  return (
    <div className="min-h-screen pb-24 overflow-y-auto" ref={scrollRef}>
      {/* Connection Status Banner */}
      <ConnectionStatus isOnline={isOnline} />
      
      {/* Sync Manager */}
      <SyncManager 
        driverId={driverId} 
        isOnline={isOnline} 
        onSyncComplete={handleSyncComplete}
      />
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 pt-8 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              {t('tours_title')}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                setIsRefreshing(true);
                await reloadTours();
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-emerald-100 text-sm">
            {aktiveTours.length} {t('tours_active').toLowerCase()} · {erledigteTours.length} {t('tours_completed').toLowerCase()} · {abgebrocheneTours.length} {t('tours_cancelled').toLowerCase()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-12 relative z-10 mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-slate-800 border border-slate-700 p-1 h-auto">
            <TabsTrigger 
              value="aktiv" 
              className="py-3 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg"
            >
              <Package className="w-4 h-4 mr-1" />
              {t('tours_active')} ({aktiveTours.length})
            </TabsTrigger>
            <TabsTrigger 
              value="erledigt" 
              className="py-3 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {t('tours_completed')} ({erledigteTours.length})
            </TabsTrigger>
            <TabsTrigger 
              value="abgebrochen" 
              className="py-3 data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-lg"
            >
              <XCircle className="w-4 h-4 mr-1" />
              {t('tours_abgebrochen')} ({abgebrocheneTours.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="px-4 space-y-4">
        {activeTab === "aktiv" && (
          <>
            {aktiveTours.length === 0 ? (
              <Card className="border-0 shadow-xl bg-slate-800/80 backdrop-blur">
                <CardContent className="p-10 text-center">
                  <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Inbox className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-300 font-medium mb-2">
                    {futureTours.length > 0 ? t('tours_today_empty') : t('tours_all_quiet')}
                  </p>
                  <p className="text-slate-500 text-sm mb-4">
                    {futureTours.length > 0 
                      ? t('tours_future_tours').replace('{count}', futureTours.length).replace('{plural}', futureTours.length === 1 ? t('tours_title').slice(0, -1) : t('tours_title'))
                      : t('tours_no_tours_assigned')
                    }
                  </p>
                  {futureTours.length > 0 && (
                    <Button
                      onClick={() => navigate(createPageUrl('Uebersicht'))}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {t('tours_to_calendar')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              // Alle Touren zeigen die normale TourActionCard
              safeMap(aktiveTours, (tour, index) => {
                const key = getSafeKey(tour, index, 'tour');
                return (
                  <TourActionCard 
                    key={key} 
                    tour={tour} 
                    onStatusUpdate={handleStatusUpdate}
                  />
                );
              })
            )}
          </>
        )}

        {activeTab === "erledigt" && (
          <>
            {/* Suchfilter */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 space-y-3">
                {/* Text-Suche */}
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">
                    Tour-ID, Kunde oder Adresse
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="z.B. Tour-123, Mustermann..."
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Datum-Filter */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-xs mb-1.5 block">Von</label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-1.5 block">Bis</label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                {/* Reset Button */}
                {(searchTerm || dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="w-full text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Filter zurücksetzen
                  </Button>
                )}
              </CardContent>
            </Card>

            {erledigteTours.length === 0 ? (
              <Card className="border-0 shadow-xl bg-slate-800/80 backdrop-blur">
                <CardContent className="p-10 text-center">
                  <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-300 font-medium">
                    {searchTerm || dateFrom || dateTo ? 'Keine Touren gefunden' : t('tours_no_completed')}
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    {searchTerm || dateFrom || dateTo ? 'Versuche andere Suchkriterien' : t('tours_completed_desc')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              safeMap(erledigteTours, (tour, index) => {
                const key = getSafeKey(tour, index, 'tour-erledigt');
                return (
                  <TourActionCard 
                    key={key} 
                    tour={tour}
                    onStatusUpdate={handleStatusUpdate}
                  />
                );
              })
            )}
          </>
        )}

        {activeTab === "abgebrochen" && (
          <>
            {abgebrocheneTours.length === 0 ? (
              <Card className="border-0 shadow-xl bg-slate-800/80 backdrop-blur">
                <CardContent className="p-10 text-center">
                  <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-300 font-medium">{t('tours_no_cancelled')}</p>
                  <p className="text-slate-500 text-sm mt-2">
                    {t('tours_cancelled_desc')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              // 🔴 KORRIGIERTER .map() AUFRUF #3
              safeMap(abgebrocheneTours, (tour, index) => {
                const key = getSafeKey(tour, index, 'tour-abgebrochen');
                return (
                  <TourActionCard 
                    key={key} 
                    tour={tour}
                    onStatusUpdate={handleStatusUpdate}
                  />
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}