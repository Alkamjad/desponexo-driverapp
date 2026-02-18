import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Euro, Calendar, Navigation, Phone, 
  CheckCircle2, Box, Truck, Loader2,
  Clock, User, Map
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/components/utils/i18n";
import { callFunction } from "@/components/utils/callFunction";
import RecurringBadge from "./RecurringBadge";
import PiecesInputModal from "./PiecesInputModal";
import FuelReportButton from "./FuelReportButton";
import TourDocumentationDialog from "./TourDocumentationDialog";
import { offlineManager } from "@/components/OfflineManager";


const STATUS_FLOW = ['assigned', 'confirmed', 'picked_up', 'delivered', 'completed'];

const getStatusConfig = () => ({
  assigned: { 
    label: t('status_assigned').split(' ')[0], 
    color: 'bg-yellow-500', 
    bgLight: 'bg-yellow-500/10',
    textColor: 'text-yellow-400',
    step: 0
  },
  confirmed: { 
    label: t('status_confirmed'), 
    color: 'bg-purple-500', 
    bgLight: 'bg-purple-500/10',
    textColor: 'text-purple-400',
    step: 1
  },
  picked_up: { 
    label: t('status_picked_up'), 
    color: 'bg-orange-500', 
    bgLight: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    step: 2
  },
  in_transit: { 
    label: t('status_in_transit'), 
    color: 'bg-cyan-500', 
    bgLight: 'bg-cyan-500/10',
    textColor: 'text-cyan-400',
    step: 2
  },
  delivered: { 
    label: t('status_delivered'), 
    color: 'bg-teal-500', 
    bgLight: 'bg-teal-500/10',
    textColor: 'text-teal-400',
    step: 3
  },
  completed: { 
    label: 'Genehmigt', 
    color: 'bg-green-500', 
    bgLight: 'bg-green-500/10',
    textColor: 'text-green-400',
    step: 4
  },
  cancelled: { 
    label: 'Storniert', 
    color: 'bg-red-500', 
    bgLight: 'bg-red-500/10',
    textColor: 'text-red-400',
    step: 0
  },
  canceled: { 
    label: 'Storniert', 
    color: 'bg-red-500', 
    bgLight: 'bg-red-500/10',
    textColor: 'text-red-400',
    step: 0
  },
  broken: { 
    label: 'Storniert', 
    color: 'bg-red-500', 
    bgLight: 'bg-red-500/10',
    textColor: 'text-red-400',
    step: 0
  },
  rejected: { 
    label: 'Storniert', 
    color: 'bg-red-500', 
    bgLight: 'bg-red-500/10',
    textColor: 'text-red-400',
    step: 0
  }
});

const TourActionCard = ({ tour, onStatusUpdate }) => {
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [piecesModalOpen, setPiecesModalOpen] = useState(false);
  const [documentationDialogOpen, setDocumentationDialogOpen] = useState(false);
  
  const driverId = localStorage.getItem("driver_id");
  const status = tour.status?.toLowerCase() || 'assigned';
  const STATUS_CONFIG = getStatusConfig();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.assigned;

  const updateStatus = async (newStatus, extraData = {}) => {
    setIsUpdating(true);
    const isOnline = navigator.onLine;

    const messages = {
      confirmed: t('tour_card_confirmed'),
      picked_up: t('tour_card_picked_up'),
      delivered: t('tour_card_delivered_success')
    };

    // 🚀 OPTIMISTISCHES UPDATE: Zeige sofort an
    const optimisticTour = {
      ...tour,
      status: newStatus,
      [`${newStatus}_at`]: new Date().toISOString()
    };

    if (onStatusUpdate) {
      onStatusUpdate(optimisticTour);
    }

    toast.success(messages[newStatus] || 'Status aktualisiert');

    try {
      // GPS im Hintergrund holen
       let location = null;
       if (navigator.geolocation) {
         try {
           const position = await new Promise((resolve, reject) => {
             navigator.geolocation.getCurrentPosition(resolve, reject, {
               enableHighAccuracy: true,
               timeout: 15000,
               maximumAge: 0
             });
           });
           location = {
             latitude: position.coords.latitude,
             longitude: position.coords.longitude,
             accuracy: position.coords.accuracy,
             timestamp: new Date().toISOString()
           };
           console.log('✅ GPS Daten erhalten:', location);
         } catch (gpsError) {
           console.warn('⚠️ GPS Fehler:', gpsError.message);
           // Fallback: Versuche gecachte Position
           try {
             const position = await new Promise((resolve, reject) => {
               navigator.geolocation.getCurrentPosition(resolve, reject, {
                 enableHighAccuracy: false,
                 timeout: 8000,
                 maximumAge: 60000  // Bis zu 1 Minute alter Daten akzeptieren
               });
             });
             location = {
               latitude: position.coords.latitude,
               longitude: position.coords.longitude,
               accuracy: position.coords.accuracy,
               timestamp: new Date().toISOString()
             };
             console.log('✅ Gecachte GPS Daten verwendet:', location);
           } catch (fallbackError) {
             console.warn('⚠️ GPS nicht verfügbar:', fallbackError.message);
           }
         }
       }

       const updateData = {
         tour_id: tour.id,
         driver_id: driverId,
         status: newStatus,
         location: location,
         ...extraData
       };

       // OFFLINE: Speichere in IndexedDB für späteren Sync
       if (!isOnline) {
         console.log('📡 Offline - Speichere Status-Update in Sync Queue:', updateData);
         await offlineManager.addToSyncQueue({
           type: 'update_tour_status',
           data: updateData,
           timestamp: new Date().toISOString()
         });
         toast.info('Wird synchronisiert wenn online');
         setIsUpdating(false);
         return;
       }

       // ONLINE: Backend-Update
       const data = await callFunction('updateTourStatus', updateData);

       if (data?.success && data.tour && onStatusUpdate) {
         onStatusUpdate(data.tour);
       } else if (!data?.success) {
         // Rollback bei Fehler
         if (onStatusUpdate) onStatusUpdate(tour);
         toast.error(data?.error || t('error'));
       }
     } catch (error) {
       console.error('Status update error:', error);
       if (onStatusUpdate) onStatusUpdate(tour);
       toast.error(t('tour_connection_error'));
     } finally {
       setIsUpdating(false);
     }
   };

  const isDocumentationRequired = tour.documentation_requirements && 
                                 Object.keys(tour.documentation_requirements).length > 0;
  const isDocumentationComplete = tour.documentation_status === 'completed' || tour.documentation_requirements === null;
  const canDeliver = !isDocumentationRequired || isDocumentationComplete;

  const handleDeliver = () => {
     // Wenn Dokumentation erforderlich ist: Zeige Dialog BEVOR Status-Update
     if (isDocumentationRequired && !isDocumentationComplete) {
       setDocumentationDialogOpen(true);
       return;
     }

     // Bei Stückvergütung: Zeige Input-Modal BEVOR Status-Update
     const isPerPiece = tour.compensation_type === 'stück' || 
                        tour.compensation_type === 'stueck' ||
                        tour.compensation_type === 'piece';

     // Fallback: Wenn compensation_type NULL aber compensation_rate gesetzt → auch Stückvergütung
     const hasRateButNoType = tour.compensation_rate && !tour.compensation_type;

     if (isPerPiece || hasRateButNoType) {
       setPiecesModalOpen(true);
       return;
     } else {
       // Direkt Status updaten (Pauschal/Stunden)
       updateStatus('delivered');
     }
   };

   const handlePiecesConfirm = async (pieces) => {
     setPiecesModalOpen(false);
     // JETZT erst Status updaten mit pieces_delivered
     await updateStatus('delivered', { pieces_delivered: pieces });
   };

  const handleDocumentationSubmit = async (documentationCompleted) => {
    setDocumentationDialogOpen(false);
    setIsUpdating(true);
    const isOnline = navigator.onLine;

    try {
       const docData = {
         tour_id: tour.id,
         driver_id: driverId,
         documentation_completed: documentationCompleted
       };

       // Aktualisiere Tour lokal mit documentation_status = 'completed'
       // WICHTIG: Setze auch documentation_requirements auf null, damit deliver-Button sofort sichtbar ist
       const updatedTour = {
         ...tour,
         documentation_status: 'completed',
         documentation_requirements: null  // Verstecke die Anforderungen, da erfüllt
       };

       // OFFLINE: Speichere in Sync Queue und aktualisiere lokal
       if (!isOnline) {
         console.log('📡 Offline - Speichere Dokumentation in Sync Queue');
         await offlineManager.addToSyncQueue({
           type: 'upload_documentation',
           data: docData,
           timestamp: new Date().toISOString()
         });
         // Aktualisiere lokal sofort, damit Fahrer deliver-Button nutzen kann
         if (onStatusUpdate) {
           onStatusUpdate(updatedTour);
         }
         toast.success('Dokumentation erfasst - wird gesendet wenn online');
         setIsUpdating(false);
         return;
       }

       // ONLINE: Hochladen
       const data = await callFunction('uploadTourDocumentation', docData);

      if (data?.success) {
        toast.success('Dokumentation erfolgreich hochgeladen!');
        // Setze auch documentation_requirements auf null, damit deliver-Button sichtbar wird
        const tourWithClearedRequirements = {
          ...data.tour,
          documentation_requirements: null
        };
        if (onStatusUpdate) {
          onStatusUpdate(tourWithClearedRequirements);
        }
      } else {
        toast.error(data?.error || 'Fehler beim Hochladen');
      }
    } catch (error) {
      toast.error('Verbindungsfehler');
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

  const getNextAction = () => {
    switch (status) {
      case 'assigned':
        return {
          label: t('tour_confirm'),
          icon: CheckCircle2,
          color: 'bg-purple-600 hover:bg-purple-700',
          action: () => updateStatus('confirmed')
        };
      case 'confirmed':
        return {
          label: t('tours_pickup'),
          icon: Box,
          color: 'bg-orange-600 hover:bg-orange-700',
          action: () => updateStatus('picked_up')
        };
      case 'picked_up':
      case 'in_transit':
        // Wenn Dokumentation erforderlich aber nicht komplett: Zeige Dokumentation erfassen Button
        if (isDocumentationRequired && !isDocumentationComplete) {
          return {
            label: 'Dokumentation erfassen',
            icon: Box,
            color: 'bg-blue-600 hover:bg-blue-700',
            action: () => setDocumentationDialogOpen(true)
          };
        }
        // Sonst: Ausliefern Button
        return {
          label: t('tours_deliver'),
          icon: Truck,
          color: 'bg-green-600 hover:bg-green-700',
          action: handleDeliver
        };
      case 'completed':
        // Erledigte Tours: Verstecke Button (nur Tour Details im View)
        return null;
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const currentStep = config.step;

  return (
    <div className="bg-slate-800/60 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header mit Tour-Nummer & Status Badge */}
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tourennummer</p>
            <p className="text-white font-semibold">{tour.tour_title || `#${tour.id}`}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {tour.is_recurring_instance && (
              <RecurringBadge tour={tour} size="sm" showDays={true} />
            )}
            {tour.is_multi_stop && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                  Multi-Stop ({tour.stops?.length || 0})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Auftraggeber */}
        <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
          <div className="size-10 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-slate-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              {t('Auftraggeber')}
            </p>
            <p className="text-white font-semibold truncate">
              {tour.client_name || tour.customer_name || 'Auftraggeber'}
            </p>
          </div>
          <Badge className={`${config.color} text-white text-xs px-2 py-1 shrink-0`}>
            {config.label}
          </Badge>
        </div>

        {/* Startdatum - Vereinacht auf DriverHome */}
        <div className="border-t border-white/5 pt-3 mt-2">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
            Startdatum
          </p>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-white font-semibold text-sm">
              {new Date(tour.scheduled_date || tour.scheduled_pickup_from).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </div>
          {tour.scheduled_delivery_from && tour.scheduled_delivery_to && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-slate-400 text-xs">
                Lieferzeit: {new Date(tour.scheduled_delivery_from).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - {new Date(tour.scheduled_delivery_to).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {/* Route - nur Abholung bei DriverHome */}
        <div className="relative pl-8 space-y-4 border-t border-white/5 pt-4">
          <div className="absolute left-[11px] top-6 bottom-6 w-0.5 bg-slate-700"></div>

          {/* Abholung */}
          {tour.pickup_address && (
            <div className="relative">
              <div className="absolute -left-10 size-6 bg-slate-900 border-2 border-slate-500 rounded-full flex items-center justify-center z-10">
                <div className="size-2 bg-slate-400 rounded-full"></div>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {t('tour_card_pickup_address')}
              </p>
              <p className="text-white font-semibold leading-tight text-sm">
                {tour.pickup_address}
              </p>
            </div>
          )}
        </div>

        </div>



        {/* Dokumentation erforderlich Hinweis */}
        {['picked_up', 'in_transit'].includes(status) && isDocumentationRequired && !isDocumentationComplete && (
          <div className="mx-4 mb-4 px-4 py-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
            <p className="text-amber-300 font-medium text-center">
              ⚠️ Bitte nicht vom Stop weggehen bevor alle Nachweise erbracht sind
            </p>
          </div>
        )}



      {/* Hauptaktion */}
      <div className="px-5 pb-6 space-y-3">
        <button
          onClick={() => navigate(createPageUrl(`TourDetails?id=${tour.id}`))}
          className="w-full py-5 rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-all flex flex-col items-center justify-center bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-500/30"
        >
          <span className="text-lg">Auf Tour gehen</span>
          <span className="text-xs font-normal text-white/70 mt-1">um alle Details zu sehen und die Tour zu bearbeiten</span>
        </button>
      </div>

        {/* GPS Tracking Hinweis */}
        {['picked_up', 'in_transit'].includes(status) && (
          <div className="mx-4 mb-4 px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-blue-300 text-sm font-medium">{t('tour_card_gps_active')}</span>
          </div>
        )}

        {/* Delivered Status */}
        {status === 'delivered' && (
          <div className="mx-4 mb-4 px-4 py-3 bg-teal-500/20 border border-teal-500/30 rounded-lg text-center">
            <Truck className="w-6 h-6 text-teal-400 mx-auto mb-1" />
            <p className="text-teal-300 font-medium">Wartet auf Genehmigung</p>
          </div>
        )}

        {/* Completed Status */}
        {status === 'completed' && (
          <div className="mx-4 mb-4 px-4 py-3 bg-green-500/20 border border-green-500/30 rounded-lg text-center">
            <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
            <p className="text-green-300 font-medium">Genehmigt</p>
          </div>
        )}


      

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
        tourId={tour.id}
      />
    </div>
  );
};

export default React.memo(TourActionCard);