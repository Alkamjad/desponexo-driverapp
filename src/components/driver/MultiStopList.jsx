import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, CheckCircle2, AlertCircle, Clock, User, Phone, FileSignature, Loader2 } from "lucide-react";
import { t } from "@/components/utils/i18n";
import { callFunction } from "@/components/utils/callFunction";
import StopProblemModal from "./StopProblemModal";
import TourDocumentationDialog from "./TourDocumentationDialog";
import { toast } from "sonner";
import moment from "moment";

const safeMap = (array, callback) => {
  if (!array || !Array.isArray(array)) return [];
  return array.map((item, index) => item ? callback(item, index) : null).filter(Boolean);
};

const MultiStopList = ({ stops, tourId, onStopUpdate, isUpdating, tourRequirements }) => {
  const [selectedStopIndex, setSelectedStopIndex] = useState(null);
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [documentationDialogOpen, setDocumentationDialogOpen] = useState(false);
  const [stopForDocumentation, setStopForDocumentation] = useState(null);



  const openNavigation = (address) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  const openMultiStopNavigation = () => {
    // Erstelle Waypoints für alle noch ausstehenden Stops
    const pendingStops = stops.filter(s => s.status === 'ausstehend');
    if (pendingStops.length === 0) return;

    const waypoints = pendingStops.map(s => encodeURIComponent(s.address)).join('|');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${waypoints}`, '_blank');
  };

  // Hole Dokumentationsanforderungen für einen Stop
  const getStopRequirements = (stop) => {
    // Prüfe zuerst ob Stop eigene Anforderungen hat (per_stop mode)
    if (stop.documentation_requirements && Object.keys(stop.documentation_requirements).length > 0) {
      return stop.documentation_requirements;
    }
    // Sonst: Nutze globale Tour-Anforderungen (same_for_all mode)
    if (tourRequirements && Object.keys(tourRequirements).length > 0) {
      return tourRequirements;
    }
    return null;
  };

  const handleStopComplete = (index, success, problemData = null) => {
    if (success) {
      const stop = stops[index];
      const requirements = getStopRequirements(stop);
      
      // PRÜFE: Dokumentation erforderlich und noch nicht erledigt?
      const hasDocRequirements = requirements && Object.keys(requirements).length > 0;
      
      if (hasDocRequirements && !stop.documentation_completed) {
        toast.warning("⚠️ " + t('multi_stop_doc_warning'), {
          duration: 4000,
          position: "top-center",
          style: {
            background: '#f59e0b',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '14px'
          }
        });
        
        setStopForDocumentation({ ...stop, index, requirements });
        setDocumentationDialogOpen(true);
        return;
      }
    }

    // Direkt Status updaten
    const updatedStops = [...stops];
    updatedStops[index] = {
      ...updatedStops[index],
      status: success ? 'zugestellt' : 'problem',
      delivered_at: success ? new Date().toISOString() : null,
      problem_type: problemData?.reason || null,
      problem_details: problemData?.details || null
    };
    onStopUpdate(updatedStops);
    setProblemModalOpen(false);
    setSelectedStopIndex(null);
  };

  const handleStopDocumentationSubmit = async (documentationCompleted) => {
    setDocumentationDialogOpen(false);

    try {
      // WICHTIG: Speichere Dokumentation direkt im Stop-Objekt
      const updatedStops = [...stops];
      updatedStops[stopForDocumentation.index] = {
        ...updatedStops[stopForDocumentation.index],
        status: 'zugestellt',
        delivered_at: new Date().toISOString(),
        // PRO STOP: documentation_completed speichern
        documentation_completed: documentationCompleted
      };

      // Update in Supabase
      await callFunction('updateTourStops', {
        tour_id: tourId,
        driver_id: localStorage.getItem('driver_id'),
        stops: updatedStops
      });

      toast.success("✅ " + t('multi_stop_doc_success'));
      onStopUpdate(updatedStops);
      setStopForDocumentation(null);
    } catch (error) {
      toast.error(t('error'));
    }
  };

  const allStopsCompleted = stops.every(s => s.status === 'zugestellt' || s.status === 'problem');
  const pendingCount = stops.filter(s => s.status === 'ausstehend').length;
  
  // Aktuellen aktiven Stop finden (nur erster AUSSTEHENDER Stop; 'problem' gilt als abgeschlossen)
  const currentStopIndex = stops.findIndex(s => s.status === 'ausstehend');
  
  // Check ob ein Stop aktiv behandelt werden kann
  const canHandleStop = (index) => {
    const stop = stops[index];
    // Nur AUSSTEHENDE Stops können behandelt werden
    if (stop.status !== 'ausstehend') return false;
    // Es darf nur der aktuelle ausstehende Stop bedient werden
    return index === currentStopIndex;
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'zugestellt':
        return { color: 'bg-green-500/20 text-green-300', icon: CheckCircle2, label: t('multi_stop_status_delivered') };
      case 'problem':
        return { color: 'bg-red-500/20 text-red-300', icon: AlertCircle, label: t('multi_stop_status_problem') };
      case 'ausstehend':
      default:
        return { color: 'bg-yellow-500/20 text-yellow-300', icon: Clock, label: t('multi_stop_status_pending') };
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="bg-slate-800 rounded-xl p-4 border-2 border-purple-500/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold">Multi-Stop Tour</h3>
          <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40">
            {stops.filter(s => s.status === 'zugestellt' || s.status === 'problem').length} / {stops.length}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Fortschritt</span>
            <span>{Math.round((stops.filter(s => s.status === 'zugestellt' || s.status === 'problem').length / stops.length) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(stops.filter(s => s.status === 'zugestellt' || s.status === 'problem').length / stops.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Alle Stops abgeschlossen */}
      {allStopsCompleted && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 text-center">
          <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
          <p className="text-green-300 text-sm font-semibold">
            {t('multi_stop_all_completed')}
          </p>
        </div>
      )}

      {/* Stops Liste */}
      {safeMap(stops, (stop, index) => {
        const isCurrentStop = canHandleStop(index);
        const isCompleted = (stop.status === 'zugestellt' || stop.status === 'problem');
        const isProblem = stop.status === 'problem';
        const statusConfig = getStatusConfig(stop.status);
        const StatusIcon = statusConfig.icon;

        return (
          <Card 
            key={index} 
            className={`border-0 transition-all ${
              isCurrentStop 
                ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-emerald-500/50 shadow-xl' 
                : isCompleted 
                  ? 'bg-slate-800/40 opacity-50 shadow-sm'
                  : 'bg-slate-800/60 shadow-sm'
            }`}
          >
            <CardContent className={isCurrentStop ? 'p-5' : 'p-3'}>
              {/* Stop Header */}
              <div className={`flex items-start gap-2 ${isCurrentStop ? 'mb-3' : 'mb-0'}`}>
                <div className={`rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCurrentStop 
                    ? 'w-10 h-10 bg-emerald-500/20 border-2 border-emerald-500/60'
                    : 'w-7 h-7 bg-slate-700/50 border border-slate-600'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className={`text-green-400 ${isCurrentStop ? 'w-5 h-5' : 'w-4 h-4'}`} />
                  ) : (
                    <span className={`font-bold ${isCurrentStop ? 'text-emerald-400 text-lg' : 'text-slate-400 text-xs'}`}>
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {isCurrentStop && (
                    <p className="text-emerald-400 text-xs font-semibold mb-1">AKTUELLER STOP</p>
                  )}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className={`font-bold truncate ${isCurrentStop ? 'text-white text-lg' : 'text-slate-300 text-sm'}`}>
                      {stop.customer_name}
                    </h4>
                    {isCurrentStop && (
                      <Badge className={`${statusConfig.color} text-xs`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Adresse - nur für aktuellen Stop ausführlich */}
                  {isCurrentStop ? (
                    <div className="rounded-lg p-2 mb-2 bg-slate-700/50">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                        <p className="text-sm text-white font-medium">
                          {stop.address}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 truncate">{stop.address}</p>
                  )}
                  
                  {/* Notizen - nur für aktuellen Stop */}
                  {isCurrentStop && stop.notes && (
                    <div className="text-xs p-2 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300">
                      💬 {stop.notes}
                    </div>
                  )}

                  {/* Telefon - nur für aktuellen Stop */}
                  {isCurrentStop && stop.phone && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-400 p-0 h-auto mt-2 hover:text-emerald-300"
                      onClick={() => window.location.href = `tel:${stop.phone}`}
                    >
                      <Phone className="w-3 h-3 mr-1" /> {stop.phone}
                    </Button>
                  )}

                  {stop.status === 'zugestellt' && stop.delivered_at && (
                    <div className="mt-2">
                      <p className="text-green-400/70 text-xs">
                        {t('multi_stop_delivered_on')} {moment(stop.delivered_at).format('DD.MM.YYYY HH:mm')}
                      </p>
                      {stop.documentation_completed && (
                        <p className="text-blue-400/70 text-xs mt-1">
                          ✓ {t('multi_stop_documented')}
                        </p>
                      )}
                    </div>
                  )}

                  {stop.status === 'problem' && (
                    <div className="mt-2 space-y-2">
                      <div className="bg-red-500/10 p-2 rounded text-xs">
                        <p className="text-red-300 font-medium">{t('multi_stop_problem_label')} {stop.problem_type || stop.problem_reason || t('multi_stop_status_problem')}</p>
                        {stop.problem_details && (
                          <p className="text-red-400/70 mt-1">{stop.problem_details}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          const updatedStops = stops.map((s, i) => 
                            i === index ? { ...s, status: 'ausstehend', problem_type: null, problem_details: null } : s
                          );
                          onStopUpdate(updatedStops);
                        }}
                        variant="outline"
                        className="w-full border-amber-400 text-amber-400 hover:bg-amber-950"
                      >
                        Stop erneut versuchen
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Dokumentationspflicht Hinweis */}
              {isCurrentStop && getStopRequirements(stop) && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mt-3">
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-3 h-3 text-yellow-400" />
                    <p className="text-yellow-300 text-xs font-medium">
                      Dokumentation erforderlich
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons - nur für aktuellen Stop */}
              {isCurrentStop && (
                <div className="space-y-2 mt-4">
                  <Button
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-semibold relative"
                    onClick={() => handleStopComplete(index, true)}
                    disabled={isUpdating}
                  >
                    {getStopRequirements(stop) && (
                      <FileSignature className="w-3 h-3 absolute top-2 right-2 text-yellow-400" />
                    )}
                    {isUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    {(getStopRequirements(stop) && !stop.documentation_completed) ? 'Nachweis hochladen' : 'Zugestellt'}
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-10 border-red-500/50 text-red-400 hover:bg-red-500/20"
                      onClick={() => {
                        setSelectedStopIndex(index);
                        setProblemModalOpen(true);
                      }}
                      disabled={isUpdating}
                    >
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Problem
                    </Button>
                    <Button
                      className="h-10 bg-blue-600 hover:bg-blue-700"
                      onClick={() => openNavigation(stop.address)}
                    >
                      <Navigation className="w-4 h-4 mr-1" />
                      Navigation
                    </Button>
                  </div>
                </div>
              )}
              

            </CardContent>
          </Card>
        );
      })}

      {/* Problem Modal */}
      {selectedStopIndex !== null && (
        <StopProblemModal
          open={problemModalOpen}
          onClose={() => {
            setProblemModalOpen(false);
            setSelectedStopIndex(null);
          }}
          onSubmit={(problemData) => handleStopComplete(selectedStopIndex, false, problemData)}
          stop={stops[selectedStopIndex]}
        />
      )}

      {/* Dokumentation Dialog für Stop */}
      {stopForDocumentation && (
        <TourDocumentationDialog
          open={documentationDialogOpen}
          onClose={() => {
            setDocumentationDialogOpen(false);
            setStopForDocumentation(null);
          }}
          onSubmit={handleStopDocumentationSubmit}
          requirements={stopForDocumentation?.requirements || {}}
          tourId={tourId}
          stopNumber={stopForDocumentation?.index + 1}
        />
      )}
    </div>
  );
};

export default React.memo(MultiStopList);