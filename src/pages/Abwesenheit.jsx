import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar, 
  Stethoscope, 
  AlertCircle, 
  Info, 
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/components/utils/i18n";
import { callFunction } from "@/components/utils/callFunction";
import supabase from "@/components/supabaseClient";


export default function AbwesenheitPage() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [requestType, setRequestType] = useState(null); // 'urlaub' or 'krank'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAbsence, setActiveAbsence] = useState(null);
  const [allAbsences, setAllAbsences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDriverData();
  }, []);

  // Polling für pending Anfragen
  useEffect(() => {
    if (!driver?.id) return;

    const checkPendingRequests = async () => {
      try {
        const { data, error } = await supabase
          .from('absence_requests')
          .select('*')
          .eq('driver_id', driver.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          // Prüfe ob sich Status geändert hat
          allAbsences.forEach(oldAbsence => {
            const newAbsence = data.find(a => a.id === oldAbsence.id);
            if (newAbsence && oldAbsence.status !== newAbsence.status) {
              // Status hat sich geändert - Update UI
              setAllAbsences(data);
              
              // Finde aktive genehmigte Abwesenheit
              const today = new Date().toISOString().split('T')[0];
              const activeAbsence = data.find(a => 
                a.requested_end_date >= today && 
                a.status === 'approved'
              );
              setActiveAbsence(activeAbsence || null);
            }
          });
        }
      } catch (error) {
        console.error('Error polling absences:', error);
      }
    };

    // Initial check
    checkPendingRequests();

    // Poll alle 15 Sekunden
    const interval = setInterval(checkPendingRequests, 15000);

    return () => clearInterval(interval);
  }, [driver, allAbsences]);

  const loadDriverData = async () => {
    const savedDriver = localStorage.getItem("driver_data");
    if (savedDriver) {
      try {
        const driverData = JSON.parse(savedDriver);
        setDriver(driverData);
        await loadAbsences(driverData.id);
      } catch (e) {
        console.error('Error loading driver data:', e);
      }
    }
    setIsLoading(false);
  };

  const loadAbsences = async (driverId) => {
    try {
      const { data, error } = await supabase
        .from('absence_requests')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAllAbsences(data);
        
        // Finde aktive genehmigte Abwesenheit
        const today = new Date().toISOString().split('T')[0];
        const activeAbsence = data.find(a => 
          a.requested_end_date >= today && 
          a.status === 'approved'
        );
        setActiveAbsence(activeAbsence || null);
      }
    } catch (error) {
      console.error('Error loading absences:', error);
    }
  };

  const validateForm = () => {
    if (!requestType) {
      toast.error('Bitte wählen Sie einen Typ (Urlaub oder Krankmeldung)');
      return false;
    }

    if (!startDate || !endDate) {
      toast.error('Bitte geben Sie beide Datumsfelder an');
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      toast.error('Das Enddatum muss nach dem Startdatum liegen');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🔵 Submit clicked', { requestType, startDate, endDate, driver });

    if (!validateForm()) {
      console.log('❌ Validation failed');
      return;
    }

    if (!driver || !driver.id || !driver.email) {
      console.error('❌ Driver data missing:', driver);
      toast.error('Fahrerdaten nicht gefunden. Bitte melden Sie sich erneut an.');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('📤 Sending request to backend...');
      
      const companyId = driver.company_id || driver.company || driver.companyId;
      
      console.log('Driver data being sent:', {
        company_id: companyId,
        driver_id: driver.id,
        driver_email: driver.email,
        has_company_id: !!companyId
      });

      const responseData = await callFunction('createAbsenceRequest', {
        company_id: companyId,
        driver_id: driver.id,
        driver_email: driver.email,
        request_type: requestType,
        requested_start_date: startDate,
        requested_end_date: endDate,
        notes: reason || ""
      });

      console.log('📥 Backend response:', responseData);

      if (responseData?.success) {
        toast.success('Ihre Abwesenheitsmeldung wurde gesendet und wartet auf Genehmigung');
        
        // Formular zurücksetzen
        setRequestType(null);
        setStartDate('');
        setEndDate('');
        setReason('');

        // Neu laden
        await loadAbsences(driver.id);
      } else {
        const errorMsg = responseData?.details?.message || responseData?.error || responseData?.message || 'Fehler beim Speichern';
        console.error('❌ Backend error:', responseData);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('❌ Error submitting absence:', error);
      console.error('❌ Error details:', error.message);
      toast.error('Fehler beim Senden: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { icon: Clock, color: 'bg-yellow-500', text: 'Ausstehend' },
      approved: { icon: CheckCircle2, color: 'bg-green-500', text: 'Genehmigt' },
      rejected: { icon: XCircle, color: 'bg-red-500', text: 'Abgelehnt' }
    };

    const { icon: Icon, color, text } = config[status] || config.pending;

    return (
      <Badge className={`${color} text-white flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {text}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-24">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-lg border-b border-emerald-900/30 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-white hover:bg-slate-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
              <Calendar className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Abwesenheit melden</h1>
              <p className="text-sm text-slate-400">Urlaub oder Krankmeldung</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        
        {/* Aktuelle Abwesenheit */}
        {activeAbsence && (
          <Alert className="bg-orange-500/20 border-orange-500/50">
            <AlertCircle className="h-5 w-5 text-orange-400" />
            <AlertDescription className="text-white ml-2">
              <div className="font-semibold mb-1">Aktuelle Abwesenheit</div>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <span>Typ:</span>
                  <Badge className={activeAbsence.request_type === 'krank' ? 'bg-red-500' : 'bg-blue-500'}>
                    {activeAbsence.request_type === 'krank' ? 'Krankmeldung' : 'Urlaub'}
                  </Badge>
                  {getStatusBadge(activeAbsence.status)}
                </div>
                <div>Von: {new Date(activeAbsence.requested_start_date).toLocaleDateString('de-DE')}</div>
                <div>Bis: {new Date(activeAbsence.requested_end_date).toLocaleDateString('de-DE')}</div>
                {(activeAbsence.notes || activeAbsence.reason) && (
                  <div>Grund: {activeAbsence.notes || activeAbsence.reason}</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Formular */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Neue Meldung erstellen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Typ Auswahl */}
              <div>
                <label className="text-sm text-slate-300 mb-2 block">Typ auswählen *</label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      console.log('🔴 Krankmeldung clicked');
                      setRequestType('krank');
                    }}
                    className={`h-20 flex flex-col gap-2 transition-all ${
                      requestType === 'krank' 
                        ? 'bg-red-500 hover:bg-red-600 text-white border-2 border-red-400 scale-105' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-2 border-slate-600'
                    }`}
                  >
                    <Stethoscope className="w-6 h-6" />
                    <span className="font-semibold">Krankmeldung</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={() => {
                      console.log('🔵 Urlaub clicked');
                      setRequestType('urlaub');
                    }}
                    className={`h-20 flex flex-col gap-2 transition-all ${
                      requestType === 'urlaub' 
                        ? 'bg-blue-500 hover:bg-blue-600 text-white border-2 border-blue-400 scale-105' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-2 border-slate-600'
                    }`}
                  >
                    <Calendar className="w-6 h-6" />
                    <span className="font-semibold">Urlaub</span>
                  </Button>
                </div>
              </div>

              {/* Datumsfelder */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-300 mb-2 block">Von Datum *</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300 mb-2 block">Bis Datum *</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              {/* Begründung */}
              <div>
                <label className="text-sm text-slate-300 mb-2 block">Begründung / Anmerkungen (optional)</label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Optional: Weitere Informationen..."
                  className="bg-slate-700 border-slate-600 text-white h-24"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Wird gesendet...
                  </>
                ) : (
                  'Abwesenheit melden'
                )}
              </Button>
            </form>

            {/* Info Box */}
            <Alert className="mt-4 bg-blue-500/20 border-blue-500/50">
              <Info className="h-5 w-5 text-blue-400" />
              <AlertDescription className="text-slate-200 ml-2 text-sm">
                <strong>Hinweis:</strong> Ihre Abwesenheitsmeldung wird an den Geschäftsführer gesendet und muss genehmigt werden. 
                Alle Ihnen zugewiesenen Touren in diesem Zeitraum werden automatisch pausiert, sobald die Genehmigung erfolgt ist.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Prozess-Info */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">So funktioniert's</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                <span className="text-emerald-400 font-bold">1</span>
              </div>
              <div>
                <div className="text-white font-medium">Meldung wird gesendet</div>
                <div className="text-slate-400 text-sm">Ihr Arbeitgeber erhält eine Benachrichtigung</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                <span className="text-emerald-400 font-bold">2</span>
              </div>
              <div>
                <div className="text-white font-medium">Genehmigung</div>
                <div className="text-slate-400 text-sm">Geschäftsführer prüft und genehmigt Ihre Abwesenheit</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                <span className="text-emerald-400 font-bold">3</span>
              </div>
              <div>
                <div className="text-white font-medium">Touren werden pausiert</div>
                <div className="text-slate-400 text-sm">Touren im Zeitraum werden automatisch umgeplant</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bisherige Meldungen - Immer anzeigen */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Bisherige Meldungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allAbsences.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Noch keine Meldungen vorhanden</p>
                <p className="text-xs text-slate-500 mt-1">Deine eingereichten Abwesenheiten erscheinen hier</p>
              </div>
            ) : (
              allAbsences.map((absence) => (
                <div key={absence.id} className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {absence.request_type === 'krank' ? (
                        <Stethoscope className="w-4 h-4 text-red-400" />
                      ) : (
                        <Calendar className="w-4 h-4 text-blue-400" />
                      )}
                      <Badge className={absence.request_type === 'krank' ? 'bg-red-500' : 'bg-blue-500'}>
                        {absence.request_type === 'krank' ? 'Krankmeldung' : 'Urlaub'}
                      </Badge>
                    </div>
                    {getStatusBadge(absence.status)}
                  </div>
                  <div className="text-sm text-slate-300 font-medium">
                    {new Date(absence.requested_start_date).toLocaleDateString('de-DE')} - {' '}
                    {new Date(absence.requested_end_date).toLocaleDateString('de-DE')}
                  </div>
                  {(absence.notes || absence.reason) && (
                    <div className="text-sm text-slate-400 italic">"{absence.notes || absence.reason}"</div>
                  )}
                  <div className="text-xs text-slate-500 pt-1 border-t border-slate-600">
                    Eingereicht: {new Date(absence.created_at).toLocaleDateString('de-DE')} um {new Date(absence.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}