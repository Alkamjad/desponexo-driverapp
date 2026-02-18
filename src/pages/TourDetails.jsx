import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { callFunction } from "@/components/utils/callFunction";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, MapPin, Phone, User, Package, Clock, Euro,
  CheckCircle2, Loader2, Navigation, Truck, Box, Fuel, FileText
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/components/utils/i18n";
import GPSTracker from "@/components/driver/GPSTracker";
import LoadingScreen from "@/components/LoadingScreen";
import RecurringBadge from "@/components/driver/RecurringBadge";
import MultiStopList from "@/components/driver/MultiStopList";
import PiecesInputModal from "@/components/driver/PiecesInputModal";
import FuelReportButton from "@/components/driver/FuelReportButton";
import TourDocumentationDialog from "@/components/driver/TourDocumentationDialog";
import supabaseClient from "@/components/supabaseClient";
import moment from "moment";

export default function TourDetails() {
  const navigate = useNavigate();
  const [tour, setTour] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [piecesModalOpen, setPiecesModalOpen] = useState(false);
  const [documentationDialogOpen, setDocumentationDialogOpen] = useState(false);

  const tourId = new URLSearchParams(window.location.search).get('id');
  const driverId = localStorage.getItem("driver_id");

  // Prüfe ob Tour heute ist
  const tourDate = tour?.tour_date || (tour?.scheduled_pickup_from ? tour.scheduled_pickup_from.split('T')[0] : null);
  const isToday = tourDate === moment().format('YYYY-MM-DD');
  const isFuture = moment(tourDate).isAfter(moment(), 'day');

  useEffect(() => {
    if (tourId) {
      loadTour();
    } else {
      navigate(createPageUrl('DriverHome'));
    }
  }, [tourId]);

  // GPS aktivieren wenn Tour abgeholt wurde
  useEffect(() => {
    if (tour && ['picked_up', 'in_transit'].includes(tour.status)) {
      setGpsActive(true);
    } else {
      setGpsActive(false);
    }
  }, [tour?.status]);



  // Multi-Stop: Check ob alle Stops abgeschlossen UND dokumentiert sind
  const allStopsCompleted = tour?.is_multi_stop 
    ? tour.stops?.every(s => {
        const completed = s.status === 'zugestellt' || s.status === 'problem';
        
        // Wenn Stop dokumentiert werden muss, prüfe ob Dokumentation vorhanden
        // ABER: Bei "problem"-Stops gilt KEINE Doku-Pflicht
        const hasRequirements = s.documentation_requirements && 
                               Object.keys(s.documentation_requirements).length > 0;
        const isDocumented = hasRequirements 
          ? (s.status === 'problem' ? true : !!s.documentation_completed)
          : true;
        
        return completed && isDocumented;
      })
    : true;

  const loadTour = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single();

      if (error) throw error;

      if (!data || !data.id) {
        toast.error(t('tour_invalid_data'));
        navigate(createPageUrl('DriverHome'));
        return;
      }

      setTour(data);
    } catch (error) {
      toast.error(t('tour_not_found'));
      navigate(createPageUrl('DriverHome'));
    } finally {
      setIsLoading(false);
    }
  };

  // Status über Backend-Funktion aktualisieren
   const updateStatus = async (newStatus, extraData = {}) => {
     setIsUpdating(true);

     try {
       // GPS-Position holen
       let location = null;
       if (navigator.geolocation) {
         try {
           const position = await new Promise((resolve, reject) => {
             navigator.geolocation.getCurrentPosition(resolve, reject, {
               enableHighAccuracy: true,
               timeout: 10000,
               maximumAge: 0
             });
           });
           location = {
             latitude: position.coords.latitude,
             longitude: position.coords.longitude,
             accuracy: position.coords.accuracy,
             timestamp: new Date().toISOString()
           };
           } catch (geoError) {
           // GPS nicht verfügbar
           }
       }

       // Backend-Update mit callFunction
       const data = await callFunction('updateTourStatus', {
         tour_id: tourId,
         driver_id: driverId,
         status: newStatus,
         location: location,
         ...extraData
       });

       if (data?.success) {
         toast.success(getStatusMessage(newStatus));

         if (newStatus === 'picked_up') {
           setGpsActive(true);
         }

         await loadTour();
       } else {
         toast.error(data?.error || 'Fehler beim Aktualisieren');
       }
     } catch (error) {
       console.error('Status update error:', error);
       toast.error(error.message || 'Verbindungsfehler');
     } finally {
       setIsUpdating(false);
     }
   };

  const getStatusMessage = (status) => {
    switch (status) {
      case 'confirmed': return t('tour_confirmed');
      case 'picked_up': return t('tour_picked_up');
      case 'delivered': return t('tour_delivered');
      default: return t('tour_status_updated');
    }
  };

  const handleConfirm = () => {
    updateStatus('confirmed');
  };
  const handlePickup = () => {
    updateStatus('picked_up');
  };
  const handleDeliver = () => {

    if (tour.is_multi_stop && !allStopsCompleted) {
      toast.error(t('tour_all_stops_complete'));
      return;
    }

    const hasDocRequirements = tour.documentation_requirements && 
                               Object.keys(tour.documentation_requirements).length > 0;
    
    const needsDocumentation = hasDocRequirements && 
                               tour.documentation_status === 'pending';
    
    if (needsDocumentation) {
      setDocumentationDialogOpen(true);
      return;
    }

    // Bei Stückvergütung: Zeige Input-Modal
    const isPerPiece = tour.compensation_type === 'stück' || 
                       tour.compensation_type === 'stueck' ||
                       tour.compensation_type === 'piece';
    
    const hasRateButNoType = tour.compensation_rate && !tour.compensation_type;
    
    if (isPerPiece || hasRateButNoType) {
      setPiecesModalOpen(true);
      return;
    }
    
    updateStatus('delivered');
  };

  const handlePiecesConfirm = async (pieces) => {
    setPiecesModalOpen(false);
    await updateStatus('delivered', { pieces_delivered: pieces });
  };

  const handleDocumentationSubmit = async (documentationCompleted) => {
     setDocumentationDialogOpen(false);
     setIsUpdating(true);

     try {
       // Backend-Update mit callFunction
       const data = await callFunction('uploadTourDocumentation', {
         tour_id: tourId,
         driver_id: driverId,
         documentation_completed: documentationCompleted
       });

       if (data?.success) {
         toast.success('Dokumentation erfolgreich hochgeladen!');
         await loadTour();
       } else {
         toast.error(data?.error || 'Fehler beim Hochladen');
       }
     } catch (error) {
       console.error('Documentation upload error:', error);
       toast.error(error.message || 'Verbindungsfehler');
     } finally {
       setIsUpdating(false);
     }
   };

  // Multi-Stop: Update einzelner Stop
   const handleStopUpdate = async (updatedStops) => {
     setIsUpdating(true);
     try {
       // Backend-Update mit callFunction
       const data = await callFunction('updateTourStops', {
         tour_id: tourId,
         stops: updatedStops
       });

       if (data?.success) {
         setTour(data.tour);
         toast.success(t('tour_status_updated'));
       } else {
         toast.error(data?.error || t('tour_connection_error'));
       }
     } catch (error) {
       console.error('Stop update error:', error);
       toast.error(error.message || t('tour_connection_error'));
     } finally {
       setIsUpdating(false);
     }
   };

  const openNavigation = (address) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  const callPhone = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  if (isLoading) {
    return <LoadingScreen message={t('tour_loading')} />;
  }

  if (!tour) return null;

  const getStatusConfig = (status) => {
    const configs = {
      assigned: { label: t('status_assigned'), color: 'bg-yellow-500', textColor: 'text-yellow-300' },
      confirmed: { label: t('status_confirmed'), color: 'bg-purple-500', textColor: 'text-purple-300' },
      picked_up: { label: t('status_picked_up'), color: 'bg-orange-500', textColor: 'text-orange-300' },
      in_transit: { label: t('status_in_transit'), color: 'bg-cyan-500', textColor: 'text-cyan-300' },
      delivered: { label: t('status_delivered'), color: 'bg-green-500', textColor: 'text-green-300' },
      completed: { label: t('status_completed'), color: 'bg-emerald-500', textColor: 'text-emerald-300' },
      cancelled: { label: t('status_cancelled'), color: 'bg-red-500', textColor: 'text-red-300' }
    };
    return configs[status?.toLowerCase()] || { label: status, color: 'bg-slate-500', textColor: 'text-slate-300' };
  };

  const statusConfig = getStatusConfig(tour.status);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className={`${statusConfig.color} p-6 pt-8`}>
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('DriverHome'))}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">
              {tour.tour_title || `Tour #${tour.tour_number || tour.id?.substring(0, 8)}`}
            </h1>
            <p className="text-white/80 text-sm">{tour.client_name || tour.customer_name}</p>
            {tour.is_recurring_instance && (
              <div className="mt-2">
                <RecurringBadge tour={tour} size="sm" showDays={true} />
              </div>
            )}
          </div>
          <Badge className="bg-white/20 text-white">
            {statusConfig.label}
          </Badge>
        </div>
        
        {/* GPS-Tracking Anzeige integriert */}
        {gpsActive && (
          <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-white text-sm font-medium">GPS-Tracking aktiv</span>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Notizen - Wichtig für Fahrer */}
        {tour.notes && (
          <Card className="border-0 shadow-lg bg-amber-900/20 border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-amber-400 text-xs mb-1 font-bold">WICHTIGER Hinweis für die Tour </p>
                  <p className="text-white font-medium leading-relaxed">{tour.notes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tankvorgang & Problem melden - Buttons nebeneinander */}
        {!isFuture && ['picked_up', 'in_transit'].includes(tour.status) && (
          <div className="flex gap-2">
            <FuelReportButton tour={tour} onUpdate={loadTour} />
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs px-3 py-1.5"
            >
              Problem für die Tour melden
            </Button>
          </div>
        )}

        {/* Multi-Stop Abholung - VOR picked_up */}
        {tour.is_multi_stop && ['assigned', 'confirmed'].includes(tour.status) && tour.pickup_address && (
          <Card className="border-0 shadow-lg bg-slate-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-slate-400 text-xs mb-1">ABHOLUNG</p>
                  <p className="text-white font-medium">{tour.pickup_address}</p>
                  {tour.pickup_postal_code && tour.pickup_city && (
                    <p className="text-slate-400 text-sm">{tour.pickup_postal_code} {tour.pickup_city}</p>
                  )}
                  {tour.pickup_contact && (
                    <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> {tour.pickup_contact}
                    </p>
                  )}
                  {tour.pickup_phone && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-400 p-0 h-auto mt-1"
                      onClick={() => callPhone(tour.pickup_phone)}
                    >
                      <Phone className="w-3 h-3 mr-1" /> {tour.pickup_phone}
                    </Button>
                  )}
                </div>
                <Button
                  size="icon"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => openNavigation(tour.pickup_address)}
                >
                  <Navigation className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-3 bg-blue-500/20 border border-blue-500/30 rounded-lg p-2">
                <p className="text-blue-300 text-xs text-center">
                  📦 {t('tour_multi_stop_info').replace('{count}', tour.stops?.length || 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Multi-Stop Liste - NACH picked_up */}
        {tour.is_multi_stop && ['picked_up', 'in_transit', 'delivered', 'completed'].includes(tour.status) && tour.stops && Array.isArray(tour.stops) && tour.stops.length > 0 ? (
          <MultiStopList 
            stops={tour.stops}
            tourId={tourId}
            onStopUpdate={handleStopUpdate}
            isUpdating={isUpdating}
            tourRequirements={tour.documentation_requirements}
          />
        ) : tour.is_multi_stop && ['picked_up', 'in_transit', 'delivered', 'completed'].includes(tour.status) ? (
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 text-center">
            <p className="text-yellow-300 text-sm">
              {t('tour_multi_stop_no_stops')}
            </p>
          </div>
        ) : null}

        {/* Standard Abholadresse (nur wenn NICHT Multi-Stop) */}
        {!tour.is_multi_stop && tour.pickup_address && (
          <Card className="border-0 shadow-lg bg-slate-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-slate-400 text-xs mb-1">ABHOLUNG</p>
                  <p className="text-white font-medium">{tour.pickup_address}</p>
                  {tour.pickup_postal_code && tour.pickup_city && (
                    <p className="text-slate-400 text-sm">{tour.pickup_postal_code} {tour.pickup_city}</p>
                  )}
                  {tour.pickup_contact && (
                    <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> {tour.pickup_contact}
                    </p>
                  )}
                  {tour.pickup_phone && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-400 p-0 h-auto mt-1"
                      onClick={() => callPhone(tour.pickup_phone)}
                    >
                      <Phone className="w-3 h-3 mr-1" /> {tour.pickup_phone}
                    </Button>
                  )}
                </div>
                <Button
                  size="icon"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => openNavigation(tour.pickup_address)}
                >
                  <Navigation className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Kundenadresse (nur wenn NICHT Multi-Stop) */}
        {!tour.is_multi_stop && tour.delivery_address && (
          <Card className="border-0 shadow-lg bg-blue-900/20 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-blue-400 text-xs mb-1 font-bold">KUNDENADRESSE</p>
                  <p className="text-white font-medium">{tour.delivery_address}</p>
                  {tour.delivery_contact && (
                    <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> {tour.delivery_contact}
                    </p>
                  )}
                  {tour.delivery_phone && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-400 p-0 h-auto mt-1"
                      onClick={() => callPhone(tour.delivery_phone)}
                    >
                      <Phone className="w-3 h-3 mr-1" /> {tour.delivery_phone}
                    </Button>
                  )}
                </div>
                <Button
                  size="icon"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => openNavigation(tour.delivery_address)}
                >
                  <Navigation className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Zieladresse nach Lieferung (nur wenn NICHT Multi-Stop) */}
        {!tour.is_multi_stop && tour.destination_address && (
          <Card className="border-0 shadow-lg bg-purple-900/20 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-purple-400 text-xs mb-1 font-bold">ZIEL NACH LIEFERUNG</p>
                  <p className="text-white font-medium">{tour.destination_address}</p>
                </div>
                <Button
                  size="icon"
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => openNavigation(tour.destination_address)}
                >
                  <Navigation className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons - Neuer Workflow */}
        <div className="space-y-3">

          {/* Warnung für zukünftige Touren */}
          {isFuture && (
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 text-center">
              <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-blue-300 font-semibold">{t('tour_future')}</p>
              <p className="text-blue-400/70 text-sm mt-1">
                {t('tour_future_desc').replace('{date}', moment(tourDate).format('DD.MM.YYYY'))}
              </p>
            </div>
          )}

          {/* Schritt 1: Tour bestätigen */}
          {!isFuture && tour.status === 'assigned' && (
            <Button 
              className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-lg font-semibold"
              onClick={handleConfirm}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
              {t('tour_confirm')}
            </Button>
          )}

          {/* Schritt 2: Ware abgeholt */}
          {!isFuture && tour.status === 'confirmed' && (
            <Button 
              className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-lg font-semibold"
              onClick={handlePickup}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Box className="w-5 h-5 mr-2" />}
              {t('tours_pickup')}
            </Button>
          )}



          {/* Schritt 3: Ausgeliefert - Button nur zeigen wenn NICHT Multi-Stop ODER wenn Multi-Stop und alle Stops fertig */}
          {!isFuture && ['picked_up', 'in_transit'].includes(tour.status) && (
            <>
              {!tour.is_multi_stop ? (
                <Button 
                  className="w-full h-14 bg-green-600 hover:bg-green-700 text-lg font-semibold"
                  onClick={() => {
                    const hasDoc = tour.documentation_requirements && Object.keys(tour.documentation_requirements).length > 0;
                    if (hasDoc && tour.documentation_status === 'pending') {
                      setDocumentationDialogOpen(true);
                    } else {
                      handleDeliver();
                    }
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Truck className="w-5 h-5 mr-2" />}
                  {(tour.documentation_requirements && Object.keys(tour.documentation_requirements).length > 0 && tour.documentation_status === 'pending') ? 'Nachweis hochladen' : t('tours_deliver')}
                </Button>
              ) : allStopsCompleted && (
                <Button 
                  className="w-full h-14 bg-green-600 hover:bg-green-700 text-lg font-semibold"
                  onClick={() => updateStatus('delivered')}
                  disabled={isUpdating}
                >
                  {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Truck className="w-5 h-5 mr-2" />}
                  Tour als ausgeliefert markieren
                </Button>
              )}
            </>
          )}

          {/* Erfolgsmeldung - Bitte zurück fahren */}
          {tour.status === 'delivered' && (
            <div className="space-y-3">
              <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-xl p-4 text-center">
                <Truck className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <p className="text-cyan-300 font-semibold">{t('status_delivered')}</p>
                <p className="text-cyan-400/70 text-sm mt-1">{t('tour_delivered_waiting')}</p>
                {tour.delivered_at && (
                  <p className="text-cyan-400/50 text-xs mt-2">
                    {new Date(tour.delivered_at).toLocaleString('de-DE')}
                  </p>
                )}
              </div>
              
              {tour.destination_address && (
                <Card className="border-0 shadow-lg bg-purple-900/20 border-purple-500/30">
                  <CardContent className="p-4">
                    <p className="text-purple-300 font-semibold mb-3 text-center">Bitte fahr zurück</p>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{tour.destination_address}</p>
                      </div>
                      <Button
                        size="icon"
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={() => openNavigation(tour.destination_address)}
                      >
                        <Navigation className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Abgerechnet */}
          {tour.status === 'completed' && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-green-300 font-semibold">{t('tour_completed')}</p>
              {tour.completed_at && (
                <p className="text-green-400/70 text-sm mt-1">
                  {new Date(tour.completed_at).toLocaleString('de-DE')}
                </p>
              )}
            </div>
          )}
        </div>



        {/* Pieces Input Modal */}
        <PiecesInputModal
          open={piecesModalOpen}
          onClose={() => setPiecesModalOpen(false)}
          onConfirm={handlePiecesConfirm}
          tour={tour}
          isUpdating={isUpdating}
        />

        {/* Tour Dokumentation Dialog */}
        <TourDocumentationDialog
          open={documentationDialogOpen}
          onClose={() => setDocumentationDialogOpen(false)}
          onSubmit={handleDocumentationSubmit}
          requirements={tour.documentation_requirements}
          tourId={tourId}
        />
        </div>
        </div>
        );
        }