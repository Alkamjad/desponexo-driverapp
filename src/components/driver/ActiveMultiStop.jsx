import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Navigation, CheckCircle2, AlertTriangle, Loader2, 
  Clock, User, Phone, Truck, FileSignature
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/components/authClient";
import { callFunction } from "@/components/utils/callFunction";
import GPSTracker from "@/components/driver/GPSTracker";
import FuelReportButton from "@/components/driver/FuelReportButton";
import StopProblemModal from "@/components/driver/StopProblemModal";
import TourDocumentationDialog from "@/components/driver/TourDocumentationDialog";
import ReturnConfirmationDialog from "@/components/driver/ReturnConfirmationDialog";



const ActiveMultiStop = ({ tour, onUpdate }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [documentationDialogOpen, setDocumentationDialogOpen] = useState(false);
  const [stopForDocumentation, setStopForDocumentation] = useState(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [localTour, setLocalTour] = useState(tour);
  const [optimisticProblems, setOptimisticProblems] = useState([]);
  
  const driverId = localStorage.getItem("driver_id");
  
  // Sync mit parent prop
  useEffect(() => {
    if (!tour) return;
    // Vermeide Überschreiben während optimistischen Updates
    const incoming = JSON.stringify(tour.stops || []);
    const current = JSON.stringify((localTour && localTour.stops) || []);
    if (incoming !== current) {
      setLocalTour(tour);
    }
  }, [tour]);



  // Finde den ersten bearbeitbaren Stop (überspringt zugestellt/problem, optimistische Problem-Stops und gesperrte Abhängigkeiten)
  const currentStop = useMemo(() => {
    if (!localTour.stops || !Array.isArray(localTour.stops)) return null;
    for (let i = 0; i < localTour.stops.length; i++) {
      const s = localTour.stops[i];
      // Überspringe bereits erledigte oder gerade als Problem gemeldete Stops
      if (s.status === 'zugestellt' || s.status === 'problem' || optimisticProblems.includes(i)) continue;
      // Abhängigkeiten prüfen
      if (typeof s.depends_on_stop_index === 'number') {
        const dep = localTour.stops[s.depends_on_stop_index];
        const depIsDone = dep && (dep.status === 'zugestellt' || dep.status === 'problem' || optimisticProblems.includes(s.depends_on_stop_index));
        if (!depIsDone) continue;
      }
      return s; // erster bearbeitbarer Stop
    }
    return null;
  }, [localTour.stops, optimisticProblems]);

  // Zähle abgeschlossene Stops
  const completedCount = useMemo(() => {
    if (!localTour.stops || !Array.isArray(localTour.stops)) return 0;
    return localTour.stops.filter(s => s.status === 'zugestellt' || s.status === 'problem').length;
  }, [localTour.stops]);

  const handleSkipToNext = () => {
    // Force re-render damit currentStop neu berechnet wird
    setLocalTour({ ...localTour });
  };

  // Prüfe ob Stop durch Abhängigkeit blockiert ist
  const isStopBlocked = useMemo(() => {
    if (!currentStop || typeof currentStop.depends_on_stop_index !== 'number') return false;
    const depIdx = currentStop.depends_on_stop_index;
    const dependentStop = localTour.stops[depIdx];
    if (!dependentStop) return false;
    const depDone = (dependentStop.status === 'zugestellt' || dependentStop.status === 'problem' || optimisticProblems.includes(depIdx));
    return !depDone;
  }, [currentStop, localTour.stops, optimisticProblems]);

  // Hole den Namen des abhängigen Stops
  const dependentStopName = useMemo(() => {
    if (!currentStop || typeof currentStop.depends_on_stop_index !== 'number') return null;
    const dependentStop = localTour.stops[currentStop.depends_on_stop_index];
    return dependentStop?.customer_name || `Stop ${currentStop.depends_on_stop_index + 1}`;
  }, [currentStop, localTour.stops]);

  const currentIndex = useMemo(() => {
    if (!currentStop || !localTour.stops) return -1;
    return localTour.stops.findIndex(
      (s) => s.address === currentStop.address && s.customer_name === currentStop.customer_name
    );
  }, [currentStop, localTour.stops]);

  // Check ob alle Stops abgeschlossen sind
  const allStopsCompleted = useMemo(() => {
    if (!localTour.stops || !Array.isArray(localTour.stops)) return false;
    return localTour.stops.every(s => s.status === 'zugestellt' || s.status === 'problem');
  }, [localTour.stops]);

  // Hole Dokumentationsanforderungen für aktuellen Stop
  const getStopRequirements = (stop) => {
    if (!stop) return null;
    
    console.log('🔍 Checking requirements for stop:', {
      customer: stop.customer_name,
      has_doc_req: !!stop.documentation_requirements,
      doc_req: stop.documentation_requirements,
      tour_doc_req: localTour.documentation_requirements
    });
    
    // Prüfe Stop-spezifische Anforderungen (per_stop mode)
    if (stop.documentation_requirements && Object.keys(stop.documentation_requirements).length > 0) {
      return stop.documentation_requirements;
    }
    
    // Fallback: Globale Tour-Anforderungen wenn same_for_all mode
    if (localTour.documentation_requirements && Object.keys(localTour.documentation_requirements).length > 0) {
      return localTour.documentation_requirements;
    }
    
    return null;
  };

  const handleCompleteTour = async () => {
    setIsUpdating(true);
    try {
      const driverId = localStorage.getItem('driver_id');
      
      const result = await callFunction('updateTourStatus', {
        tour_id: localTour.id,
        driver_id: driverId,
        status: 'delivered'
      });
      
      if (result.success && result.tour) {
        toast.success('✓ Tour abgeschlossen');
        setLocalTour(result.tour);
        onUpdate?.(result.tour);
      } else {
        toast.error(result.error || 'Fehler beim Abschließen');
      }
    } catch (error) {
      toast.error('Verbindungsfehler');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeliver = async () => {
    if (!currentStop) return;

    const requirements = getStopRequirements(currentStop);
    const hasDocRequirements = requirements && Object.keys(requirements).length > 0;
    
    // PRÜFE: Dokumentation erforderlich und noch nicht erledigt?
    if (hasDocRequirements && !currentStop.documentation_completed) {
      toast.warning("⚠️ Bitte Dokumentation ausfüllen", {
        duration: 4000,
        position: "top-center",
        style: { background: '#f59e0b', color: '#000', fontWeight: 'bold' }
      });
      setStopForDocumentation({ ...currentStop, index: currentIndex, requirements });
      setDocumentationDialogOpen(true);
      return;
    }

    // Wenn Retoure vorhanden → zuerst bestätigen lassen
    if (currentStop.return_goods || currentStop.return_goods_quantity) {
      setReturnDialogOpen(true);
      return;
    }

    // Direkt zustellen (ohne Retoure/Doku)
    setIsUpdating(true);
    try {
      const updatedStops = localTour.stops.map((s, idx) => 
        idx === currentIndex
          ? { ...s, status: 'zugestellt', delivered_at: new Date().toISOString() }
          : s
      );
      const response = await authClient.updateTourStops(localTour.id, updatedStops);
      if (response.success && response.tour) {
        toast.success('✓ Stop zugestellt');
        setLocalTour(response.tour);
        onUpdate?.(response.tour);
      } else {
        toast.error(response.error || 'Fehler');
      }
    } catch (error) {
      toast.error('Verbindungsfehler');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReturnConfirm = async ({ collected, reason }) => {
    if (!currentStop) return;
    setIsUpdating(true);
    try {
      const updatedStops = localTour.stops.map((s, idx) => 
        idx === currentIndex
          ? {
              ...s,
              status: 'zugestellt',
              delivered_at: new Date().toISOString(),
              return_goods_collected: !!collected,
              return_goods_not_collected_reason: collected ? null : (reason || '')
            }
          : s
      );
      const response = await authClient.updateTourStops(localTour.id, updatedStops);
      if (response.success && response.tour) {
        setReturnDialogOpen(false);
        toast.success('✓ Stop zugestellt');
        setLocalTour(response.tour);
        onUpdate?.(response.tour);
      } else {
        toast.error(response.error || 'Fehler');
      }
    } catch (error) {
      toast.error('Verbindungsfehler');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProblemSubmit = useCallback(async (problemData) => {
    if (!currentStop) return;
    setIsUpdating(true);
    try {
      const updatedStops = localTour.stops.map((s, idx) => 
        idx === currentIndex
          ? { 
              ...s, 
              status: 'problem',
              problem_type: problemData.reason,
              problem_details: problemData.details,
              problem_reported_at: new Date().toISOString()
            }
          : s
      );

      // Optimistisch markieren und lokalen Zustand updaten -> sofortiger Sprung
      setOptimisticProblems(prev => (prev.includes(currentIndex) ? prev : [...prev, currentIndex]));
      setLocalTour(prev => ({ ...prev, stops: updatedStops }));
      setProblemModalOpen(false);

      const response = await authClient.updateTourStops(localTour.id, updatedStops);
      if (response?.success && response?.tour) {
        // Backend bestätigt: lokalen Tour-State übernehmen und Optimismus bereinigen
        setLocalTour(response.tour);
        setOptimisticProblems(prev => prev.filter(i => i !== currentIndex));
        toast.success('✓ Problem gemeldet');
        onUpdate?.(response.tour);
      } else {
        // Fehler -> Optimismus zurücknehmen
        setOptimisticProblems(prev => prev.filter(i => i !== currentIndex));
        toast.error(response?.error || 'Fehler beim Aktualisieren');
      }
    } catch (error) {
      setOptimisticProblems(prev => prev.filter(i => i !== currentIndex));
      toast.error(error?.message || 'Verbindungsfehler');
    } finally {
      setIsUpdating(false);
    }
  }, [currentStop, currentIndex, localTour, onUpdate]);

  const handleDocumentationSubmit = async (documentationCompleted) => {
    if (!currentStop) return;
    setIsUpdating(true);
    try {
      const updatedStops = localTour.stops.map((s, idx) => 
        idx === currentIndex
          ? { 
              ...s, 
              status: 'zugestellt', 
              delivered_at: new Date().toISOString(),
              documentation_completed: documentationCompleted
            }
          : s
      );
      const response = await authClient.updateTourStops(localTour.id, updatedStops);
      if (response.success && response.tour) {
        setDocumentationDialogOpen(false);
        setStopForDocumentation(null);
        toast.success('✅ Stop dokumentiert und zugestellt');
        setLocalTour(response.tour);
        onUpdate?.(response.tour);
      } else {
        toast.error(response.error || 'Fehler');
      }
    } catch (error) {
      toast.error('Verbindungsfehler');
    } finally {
      setIsUpdating(false);
    }
  };

  const openNavigation = () => {
    if (!currentStop) return;
    const encoded = encodeURIComponent(currentStop.address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  const callPhone = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  // Wenn alle Stops abgeschlossen → Tour abschließen Button
  if (allStopsCompleted) {
    return (
      <>
        <GPSTracker driverId={driverId} tourId={tour.id} isActive={true} />
        
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-600 to-green-800">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <CheckCircle2 className="w-16 h-16 text-white mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Alle Stops abgeschlossen!</h3>
              <p className="text-green-100">
                {completedCount} von {tour.stops?.length} Stops erledigt
              </p>
            </div>
            
            <Button
              onClick={handleCompleteTour}
              disabled={isUpdating}
              className="w-full h-14 bg-white text-green-700 hover:bg-green-50 font-semibold text-lg"
            >
              {isUpdating ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Truck className="w-5 h-5 mr-2" />
              )}
              Tour abschließen
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  // Wenn kein aktueller Stop → Fehler
  if (!currentStop) {
    return (
      <Card className="border-0 shadow-lg bg-slate-800">
        <CardContent className="p-6 text-center">
          <p className="text-slate-400">Kein aktiver Stop gefunden</p>
        </CardContent>
      </Card>
    );
  }

  const requirements = getStopRequirements(currentStop);
  const hasDocRequirements = requirements && Object.keys(requirements).length > 0;

  return (
    <>
      {/* GPS Tracker */}
      <GPSTracker 
        driverId={driverId} 
        tourId={tour.id} 
        isActive={true}
      />

      {/* Progress Header */}
      <div className="bg-slate-800 rounded-xl p-4 border-2 border-purple-500/30 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold text-lg">{localTour.tour_title || 'Multi-Stop Tour'}</h3>
          <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40">
            {completedCount} / {localTour.stops?.length || 0}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Fortschritt</span>
            <span>{Math.round((completedCount / (tour.stops?.length || 1)) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / (tour.stops?.length || 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tankvorgang Button */}
      <div className="mb-4">
        <FuelReportButton tour={localTour} onUpdate={onUpdate} />
      </div>

      {/* Aktueller Stop */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-emerald-500/50">
        <CardContent className="p-6">
          {/* Stop Number */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center border-2 border-emerald-500/60">
              <span className="text-emerald-400 font-bold text-lg">{currentIndex + 1}</span>
            </div>
            <div>
              <p className="text-emerald-400 text-xs font-semibold">AKTUELLER STOP</p>
              <h3 className="text-white font-bold text-xl">{currentStop.customer_name}</h3>
            </div>
          </div>

          {/* Adresse */}
          <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-base">{currentStop.address}</p>
                {(currentStop.time_window_from || currentStop.time_window_to) && (
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-300 text-sm">
                      Lieferung {currentStop.time_window_from && currentStop.time_window_to 
                        ? `zwischen ${currentStop.time_window_from} - ${currentStop.time_window_to} Uhr`
                        : currentStop.time_window_from 
                        ? `ab ${currentStop.time_window_from} Uhr`
                        : `bis ${currentStop.time_window_to} Uhr`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kontakt */}
          {(currentStop.contact_name || currentStop.contact_phone || currentStop.phone) && (
            <div className="bg-slate-700/50 rounded-xl p-4 mb-4 space-y-2">
              {currentStop.contact_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">{currentStop.contact_name}</span>
                </div>
              )}
              {(currentStop.contact_phone || currentStop.phone) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-400 p-0 h-auto hover:text-emerald-300"
                  onClick={() => callPhone(currentStop.contact_phone || currentStop.phone)}
                >
                  <Phone className="w-4 h-4 mr-1" /> {currentStop.contact_phone || currentStop.phone}
                </Button>
              )}
            </div>
          )}

          {/* Retouren-Hinweis */}
          {(currentStop.return_goods || currentStop.return_goods_quantity) && (
            <div className="bg-orange-500/20 border-2 border-orange-500/50 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-300 font-bold text-lg">↩</span>
                </div>
                <div>
                  <p className="text-orange-300 font-bold text-base mb-1">⚠️ RETOURE MITNEHMEN</p>
                  {currentStop.return_goods_quantity && (
                    <p className="text-orange-200 text-sm">Anzahl: {currentStop.return_goods_quantity}x</p>
                  )}
                  {currentStop.return_goods_description && (
                    <p className="text-orange-200 text-sm">{currentStop.return_goods_description}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Abhängigkeits-Warnung */}
          {isStopBlocked && (
            <div className="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-300 font-bold text-sm">Dieser Stop ist gesperrt</p>
                  <p className="text-red-200 text-xs mt-1">
                    Kann erst nach "{dependentStopName}" beliefert werden
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Hinweise */}
          {currentStop.notes && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
              <p className="text-blue-300 text-sm">💬 {currentStop.notes}</p>
            </div>
          )}

          {/* Dokumentationspflicht Hinweis */}
          {hasDocRequirements && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-yellow-400" />
                <p className="text-yellow-300 text-sm font-medium">
                  Dokumentation erforderlich bei Zustellung
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {currentStop.status === 'problem' ? (
              <Button
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-lg font-semibold"
                onClick={handleSkipToNext}
              >
                <Navigation className="w-5 h-5 mr-2" />
                Weiter zum nächsten Stop
              </Button>
            ) : (
              <Button
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-lg font-semibold relative"
                onClick={handleDeliver}
                disabled={isUpdating || isStopBlocked}
              >
                {hasDocRequirements && (
                  <FileSignature className="w-4 h-4 absolute top-2 right-2 text-yellow-400" />
                )}
                {isUpdating ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                )}
                {isStopBlocked ? 'Gesperrt' : (hasDocRequirements && !currentStop.documentation_completed ? 'Nachweis hochladen' : 'Zugestellt') }
              </Button>
            )}

            {currentStop.status !== 'problem' && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-12 border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                  onClick={() => setProblemModalOpen(true)}
                  disabled={isUpdating || isStopBlocked}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Problem
                </Button>
                <Button
                  className="h-12 bg-blue-600 hover:bg-blue-700"
                  onClick={openNavigation}
                  disabled={isUpdating}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Navigation
                </Button>
              </div>
            )}
          </div>

          {/* Nächster Stop Preview */}
          {localTour.stops && currentIndex < localTour.stops.length - 1 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-slate-500 text-xs mb-2">NÄCHSTER STOP:</p>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <p className="text-slate-400 text-sm">{localTour.stops[currentIndex + 1].customer_name}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Problem Modal */}
      <StopProblemModal
        open={problemModalOpen}
        onClose={() => setProblemModalOpen(false)}
        onSubmit={handleProblemSubmit}
        stop={currentStop}
      />

      {/* Retoure-Bestätigung */}
      <ReturnConfirmationDialog
        open={returnDialogOpen}
        onClose={() => setReturnDialogOpen(false)}
        onConfirm={handleReturnConfirm}
        quantity={currentStop?.return_goods_quantity}
        description={currentStop?.return_goods_description}
      />

      {/* Dokumentation Dialog */}
      {stopForDocumentation && (
        <TourDocumentationDialog
          open={documentationDialogOpen}
          onClose={() => {
            setDocumentationDialogOpen(false);
            setStopForDocumentation(null);
          }}
          onSubmit={handleDocumentationSubmit}
          requirements={stopForDocumentation?.requirements || {}}
          tourId={tour.id}
          stopNumber={stopForDocumentation?.index + 1}
        />
      )}
    </>
  );
};

export default React.memo(ActiveMultiStop);