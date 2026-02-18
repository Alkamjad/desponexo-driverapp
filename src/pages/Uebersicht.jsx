import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Package, MapPin, Clock, Loader2, ChevronRight, X, Phone, User, Navigation, Map } from "lucide-react";
import { t } from "@/components/utils/i18n";
import moment from "moment";
import LoadingScreen from "@/components/LoadingScreen";
import { useOfflineStatus } from "@/components/hooks/useOfflineStatus";
import { useMyToursRealtime } from "@/components/hooks/useMyToursRealtime";
import ConnectionStatus from "@/components/ConnectionStatus";
import { useScrollRestoration } from "@/components/hooks/useScrollRestoration";
import { useAuth } from "@/components/AuthContext";

export default function Uebersicht() {
  const isOnline = useOfflineStatus();
  const navigate = useNavigate();
  const { driverId } = useAuth();
  const { data: tours, isLoading } = useMyToursRealtime(driverId);
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const scrollRef = useScrollRestoration('Uebersicht');

  // Prüfe ob driverId existiert
  useEffect(() => {
    if (!driverId && navigator.onLine) {
      navigate(createPageUrl('Anmelden'));
    }
  }, [driverId, navigate]);

  // Gruppiere Touren nach Datum (tour_date ist jetzt für alle Touren vorhanden)
  const toursByDate = tours.reduce((acc, tour) => {
    // Completed Touren nicht anzeigen
    if (tour.status?.toLowerCase() === 'completed') {
      return acc;
    }
    
    // Extrahiere Datum aus tour_date, scheduled_pickup_from oder scheduled_date
    const dateSource = tour.tour_date || 
      (tour.scheduled_pickup_from ? tour.scheduled_pickup_from.split('T')[0] : null) ||
      tour.scheduled_date;
    
    if (dateSource) {
      const date = moment(dateSource).format('YYYY-MM-DD');
      if (!acc[date]) acc[date] = [];
      acc[date].push(tour);
    }
    
    return acc;
  }, {});

  // Sortierte Datumsliste
  const sortedDates = Object.keys(toursByDate).sort();

  // Generiere Kalender-Tage (aktueller Monat + nächster Monat)
  const generateCalendarDays = () => {
    const days = [];
    const today = moment();
    const startOfMonth = moment().startOf('month');
    const endOfNextMonth = moment().add(1, 'month').endOf('month');
    
    let current = startOfMonth.clone();
    while (current.isSameOrBefore(endOfNextMonth)) {
      days.push(current.clone());
      current.add(1, 'day');
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();

  // Gruppiere Tage nach Monat
  const daysByMonth = calendarDays.reduce((acc, day) => {
    const monthKey = day.format('YYYY-MM');
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(day);
    return acc;
  }, {});

  const toursForSelectedDate = toursByDate[selectedDate] || [];

  if (isLoading) {
    return <LoadingScreen message={t('overview_loading')} />;
  }

  return (
    <div className="min-h-screen pb-24 overflow-y-auto" ref={scrollRef}>
      {/* Connection Status Banner */}
      <ConnectionStatus isOnline={isOnline} />
      
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 pt-8 pb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            {t('overview_title')}
          </h1>
          <p className="text-emerald-100 text-sm mt-1">
            {t('overview_days_with_tours').replace('{count}', sortedDates.length)}
          </p>
        </div>
      </div>

      {/* Kalender */}
      <div className="px-4 mt-6 space-y-6">
        {Object.entries(daysByMonth).map(([monthKey, days]) => (
          <Card key={monthKey} className="border-0 shadow-lg bg-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">
                {moment(monthKey).format('MMMM YYYY')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Wochentage */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {[
                  t('calendar_mon'), 
                  t('calendar_tue'), 
                  t('calendar_wed'), 
                  t('calendar_thu'), 
                  t('calendar_fri'), 
                  t('calendar_sat'), 
                  t('calendar_sun')
                ].map(day => (
                  <div key={day} className="text-center text-xs text-slate-500 font-medium py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Kalender-Tage */}
              <div className="grid grid-cols-7 gap-1">
                {/* Leere Zellen für Start-Offset */}
                {Array.from({ length: (days[0].isoWeekday() - 1) }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                
                {days.map(day => {
                  const dateStr = day.format('YYYY-MM-DD');
                  const hasTours = toursByDate[dateStr]?.length > 0;
                  const isToday = day.isSame(moment(), 'day');
                  const isSelected = dateStr === selectedDate;
                  const isPast = day.isBefore(moment(), 'day');

                  const handleDateClick = () => {
                    if (hasTours) {
                      setSelectedDate(dateStr);
                      setModalOpen(true);
                    }
                  };

                  return (
                    <button
                      key={dateStr}
                      onClick={handleDateClick}
                      disabled={!hasTours}
                      className={`
                        relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all
                        ${hasTours ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-pointer hover:scale-105 hover:bg-emerald-500/30' : ''}
                        ${!hasTours && isToday ? 'bg-slate-700 text-white border border-slate-600' : ''}
                        ${!hasTours && !isToday && !isPast ? 'bg-slate-900/50 text-slate-400' : ''}
                        ${!hasTours ? 'opacity-30 cursor-not-allowed' : ''}
                      `}
                    >
                      <span className="font-semibold">{day.format('D')}</span>
                      {hasTours && (
                        <div className="absolute bottom-1 flex gap-0.5">
                          {toursByDate[dateStr].slice(0, 3).map((_, i) => (
                            <div key={i} className="w-1 h-1 rounded-full bg-emerald-400" />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal für Tour-Details */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
              <Calendar className="w-6 h-6 text-emerald-400" />
              {selectedDate ? moment(selectedDate).format('DD.MM.YYYY') : t('overview_tours')}
              {toursForSelectedDate.length > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-300 ml-auto">
                  {toursForSelectedDate.length} {toursForSelectedDate.length === 1 ? t('tours_title').slice(0, -1) : t('overview_tours')}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {toursForSelectedDate.map(tour => {
              const statusConfig = {
                assigned: { color: 'bg-yellow-500/20 text-yellow-300', label: t('status_assigned') },
                confirmed: { color: 'bg-purple-500/20 text-purple-300', label: t('status_confirmed') },
                picked_up: { color: 'bg-orange-500/20 text-orange-300', label: t('status_picked_up') },
                in_transit: { color: 'bg-cyan-500/20 text-cyan-300', label: t('status_in_transit') },
                delivered: { color: 'bg-green-500/20 text-green-300', label: t('status_delivered') },
                completed: { color: 'bg-emerald-500/20 text-emerald-300', label: t('status_completed') },
                cancelled: { color: 'bg-red-500/20 text-red-300', label: t('status_cancelled') }
              }[tour.status?.toLowerCase()] || { color: 'bg-slate-500/20 text-slate-300', label: tour.status };

              const openNavigation = (address) => {
                const encoded = encodeURIComponent(address);
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
              };

              const callPhone = (phone) => {
                window.location.href = `tel:${phone}`;
              };

              const tourDate = tour.tour_date || (tour.scheduled_pickup_from ? tour.scheduled_pickup_from.split('T')[0] : null);
              const isToday = tourDate === moment().format('YYYY-MM-DD');
              const isFuture = moment(tourDate).isAfter(moment().startOf('day'), 'day');

              return (
                <Card key={tour.id} className="border-0 shadow-lg bg-slate-700/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-white font-semibold">
                            {tour.tour_title || 'Tour'}
                          </h3>
                          <Badge className={`${statusConfig.color} text-xs`}>
                            {statusConfig.label}
                          </Badge>
                          {tour.is_multi_stop && (
                            <Badge className="bg-purple-500/20 text-purple-300 text-xs">
                              <Map className="w-3 h-3 mr-1" />
                              {tour.stops?.length || 0} {t('multi_stop_stops')}
                            </Badge>
                          )}
                          {isFuture && (
                            <Badge className="bg-blue-500/20 text-blue-300 text-xs">
                              {t('overview_future')}
                            </Badge>
                          )}
                        </div>

                        {tour.customer_name && (
                          <p className="text-xs text-slate-400">{t('overview_customer')} {tour.customer_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Multi-Stop oder Standard Adressen */}
                    <div className="space-y-3 border-t border-slate-600 pt-3">
                      {tour.is_multi_stop ? (
                        <div>
                          <p className="text-xs text-slate-400 mb-2">{t('overview_multi_stop')}</p>
                          {tour.stops?.slice(0, 2).map((stop, idx) => (
                            <div key={idx} className="flex items-start gap-2 mb-2">
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-400 text-xs font-semibold">{idx + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-400">{stop.customer_name}</p>
                                <p className="text-sm text-white line-clamp-1">{stop.address}</p>
                              </div>
                            </div>
                          ))}
                          {tour.stops?.length > 2 && (
                            <p className="text-xs text-slate-500 ml-8">
                              {t('overview_more_stops').replace('{count}', tour.stops.length - 2)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          {tour.pickup_address && (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-400 mb-1">{t('overview_pickup')}</p>
                            <p className="text-sm text-white font-medium">{tour.pickup_address}</p>
                          </div>
                          <Button
                            size="icon"
                            className="bg-emerald-600 hover:bg-emerald-700 flex-shrink-0"
                            onClick={() => openNavigation(tour.pickup_address)}
                          >
                            <Navigation className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

                      {tour.delivery_address && (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-400 mb-1">{t('overview_delivery')}</p>
                            <p className="text-sm text-white font-medium">{tour.delivery_address}</p>
                          </div>
                          <Button
                            size="icon"
                            className="bg-red-600 hover:bg-red-700 flex-shrink-0"
                            onClick={() => openNavigation(tour.delivery_address)}
                          >
                            <Navigation className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                        </>
                      )}
                    </div>



                    {isFuture ? (
                      <div className="mt-3 bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 text-center">
                        <p className="text-blue-300 text-sm">
                          {t('overview_future_tour')}
                        </p>
                      </div>
                    ) : (
                      <Button
                        className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          setModalOpen(false);
                          navigate(createPageUrl('TourDetails') + `?id=${tour.id}`);
                        }}
                      >
                        {t('overview_open_tour')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}