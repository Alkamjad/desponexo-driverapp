import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fuel, Upload, Loader2, Euro, Droplet, Gauge, AlertCircle, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/components/utils/i18n";
import { compressImage } from "@/components/utils/imageCompression";
import { offlineManager } from "@/components/OfflineManager";
import { callFunction } from "@/components/utils/callFunction";

export default function FuelReportModal({ open, onClose, tour, onUpdate }) {
  const [step, setStep] = useState(1); // 1: Vehicle Confirmation, 2: Fuel Details
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    liters: "",
    amount: "",
    payment_method: "eigenes_geld",
    mileage: "",
    receipt_photo_url: "",
    vehicle_confirmed: false,
    photo_is_offline: false
  });

  const driverEmail = localStorage.getItem("driver_email");

  React.useEffect(() => {
    if (open && tour) {
      console.log("🔍 Tour Objekt für Tankbeleg:", {
        id: tour.id,
        tour_id: tour.tour_id,
        license_plate: tour.license_plate,
        vehicle_plate: tour.vehicle_plate,
        fuel_report_id: tour.fuel_report_id,
        fuel_report: tour.fuel_report,
        alle_keys: Object.keys(tour)
      });
      
      // 🔥 KRITISCH: Prüfe BEIDE - fuel_report Objekt UND fuel_report_id
      const hasFuelReport = tour.fuel_report_id || tour.fuel_report;
      
      if (hasFuelReport) {
        console.log("✅ Fuel Report gefunden - lade Daten zum Bearbeiten");
        setIsEditing(true);
        
        // Wenn fuel_report Objekt vorhanden ist, nutze es
        if (tour.fuel_report && typeof tour.fuel_report === 'object') {
          setFormData({
            liters: tour.fuel_report.liters?.toString() || "",
            amount: tour.fuel_report.amount?.toString() || "",
            payment_method: tour.fuel_report.payment_method || "eigenes_geld",
            mileage: tour.fuel_report.mileage?.toString() || "",
            receipt_photo_url: tour.fuel_report.receipt_photo_url || "",
            vehicle_confirmed: true,
            photo_is_offline: false
          });
        } else {
          // Fallback: nur fuel_report_id vorhanden - zeige leere Felder aber im Edit-Modus
          setFormData({
            liters: "",
            amount: "",
            payment_method: "eigenes_geld",
            mileage: "",
            receipt_photo_url: "",
            vehicle_confirmed: true,
            photo_is_offline: false
          });
        }
        setStep(2); // Direkt zu Step 2
      } else {
        // Kein Fuel Report - normaler Create-Modus
        console.log("ℹ️ Kein Fuel Report - Create-Modus");
        setStep(1);
        setIsEditing(false);
        setFormData({
          liters: "",
          amount: "",
          payment_method: "eigenes_geld",
          mileage: "",
          receipt_photo_url: "",
          vehicle_confirmed: false,
          photo_is_offline: false
        });
      }
    }
  }, [open, tour]);

  const handlePhotoUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    const isOnline = navigator.onLine;

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setUploading(true);
      try {
        // Bild komprimieren
        const compressedFile = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.8,
          maxSizeMB: 1
        });

        // OFFLINE: Speichere Bild lokal als Data URL
        if (!isOnline) {
          console.log('📡 Offline - Speichere Bild lokal');
          const reader = new FileReader();
          reader.onload = (event) => {
            setFormData(prev => ({ 
              ...prev, 
              receipt_photo_url: event.target.result, // Data URL
              photo_is_offline: true
            }));
            toast.success('Foto lokal gespeichert - wird hochgeladen wenn online');
          };
          reader.readAsDataURL(compressedFile);
          return;
        }

        // ONLINE: Hochladen
          const formDataToSend = new FormData();
          formDataToSend.append('file', compressedFile);
          formDataToSend.append('driver_email', driverEmail);

          const uploadResult = await callFunction('uploadDriverFile', formDataToSend);

          if (uploadResult.file_url) {
            setFormData(prev => ({ 
              ...prev, 
              receipt_photo_url: uploadResult.file_url,
              photo_is_offline: false
            }));
            toast.success(t('fuel_photo_uploaded'));
          } else {
            console.error('❌ Keine file_url in Response:', uploadResult);
            toast.error('Foto-Upload Response ungültig');
          }
      } catch (error) {
        console.error('Upload fehlgeschlagen:', error);
        toast.error(t('fuel_photo_failed'));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleVehicleConfirm = () => {
    if (!formData.vehicle_confirmed) {
      toast.error(t('fuel_error_confirm'));
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    // VALIDIERUNG
    const errors = [];
    const isOnline = navigator.onLine;

    if (!formData.liters || parseFloat(formData.liters) <= 0) {
      errors.push(t('fuel_error_liters'));
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.push(t('fuel_error_amount'));
    }
    if (!formData.mileage || parseInt(formData.mileage) <= 0) {
      errors.push(t('fuel_error_km'));
    }
    // Beleg ist jetzt OPTIONAL - nicht mehr Pflichtfeld
    if (!formData.vehicle_confirmed) {
      errors.push(t('fuel_error_confirm'));
    }

    if (errors.length > 0) {
      errors.forEach(error => toast.error(error));
      return;
    }

    setSubmitting(true);

    const tourIdToSend = tour.tour_id || tour.id;

    console.log("📤 Sende Tankbeleg-Daten:", {
      tourIdToSend,
      isOnline,
      isEditing,
      formData
    });

    try {
      const fuelData = {
        tour_id: tourIdToSend,
        driver_email: driverEmail,
        liters: parseFloat(formData.liters),
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        mileage: parseInt(formData.mileage),
        receipt_photo_url: formData.receipt_photo_url, // Kann null/empty sein
        vehicle_confirmed: formData.vehicle_confirmed
      };

      // OFFLINE: Speichere in Sync Queue
      if (!isOnline) {
        console.log('📡 Offline - Speichere Tankbericht in Sync Queue');
        await offlineManager.addToSyncQueue({
          type: isEditing ? 'update_fuel_report' : 'submit_fuel_report',
          data: fuelData,
          fuel_report_id: tour.fuel_report?.id,
          timestamp: new Date().toISOString()
        });

        toast.success(isEditing ? 'Tankbericht aktualisiert - wird gesendet wenn online' : 'Tankbericht erfasst - wird gesendet wenn online');
        setSubmitting(false);
        onClose();
        return;
      }

      // ONLINE: Hochladen
      const endpoint = isEditing ? 'updateFuelReport' : 'submitFuelReport';
      const fuelReportData = isEditing ? { ...fuelData, fuel_report_id: tour.fuel_report?.id } : fuelData;

      const result = await callFunction(endpoint, fuelReportData);

      if (result?.success) {
        toast.success(result.message || (isEditing ? 'Tankbericht aktualisiert!' : t('fuel_success')));
        setSubmitting(false);
        onClose();
        if (onUpdate) {
          onUpdate();
        }
      } else {
        console.error("Backend Fehler:", result?.error);
        toast.error(result?.error || t('fuel_error'));
      }
    } catch (error) {
      console.error('Submit Fehler:', error);
      toast.error(t('fuel_error_connection'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Berechne Preis pro Liter (optional)
  const pricePerLiter = formData.liters && formData.amount 
    ? (parseFloat(formData.amount) / parseFloat(formData.liters)).toFixed(2)
    : null;

  if (!tour) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-400">
              <AlertCircle className="w-6 h-6 inline mr-2" />
              {t('error')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-300">{t('fuel_no_tour_data')}</p>
        </DialogContent>
      </Dialog>
    );
  }

  const vehiclePlate = tour.license_plate || tour.vehicle_plate || t('fuel_not_specified');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700/50 text-white max-w-md max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
        <DialogHeader className="pb-3 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Fuel className="w-6 h-6 text-blue-400" />
              </div>
              {isEditing ? 'Tankbeleg bearbeiten' : t('fuel_title')}
            </DialogTitle>
            {isEditing && (
              <div className="bg-blue-500/20 text-blue-300 text-xs font-semibold px-3 py-1 rounded-full border border-blue-500/40">
                Bearbeitung
              </div>
            )}
          </div>
        </DialogHeader>

        {/* STEP 1: Fahrzeugbestätigung */}
        {step === 1 && (
          <div className="space-y-5 mt-6">
            <div className="bg-gradient-to-br from-blue-500/30 to-blue-600/10 border border-blue-500/50 rounded-xl p-6 backdrop-blur-sm">
              <p className="text-blue-200 text-xs uppercase tracking-widest font-semibold mb-4 opacity-80">
                Schritt 1: Fahrzeugbestätigung
              </p>
              <p className="text-blue-300 text-sm mb-4 leading-relaxed">
                Sie sind dabei, einen Tankbeleg für folgendes Fahrzeug einzureichen:
              </p>
              <div className="bg-blue-900/50 rounded-lg p-5 border border-blue-400/30 mb-4 shadow-lg">
                <p className="text-center text-4xl font-bold text-blue-100 tracking-wider font-mono">
                  {vehiclePlate}
                </p>
              </div>
              <p className="text-blue-200 text-sm leading-relaxed">
                Bitte bestätigen Sie, dass dies das korrekte Fahrzeug ist, damit wir den Tankbeleg richtig zuordnen können.
              </p>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/50 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <Checkbox
                  id="vehicle-confirmed"
                  checked={formData.vehicle_confirmed}
                  onCheckedChange={(checked) => handleInputChange('vehicle_confirmed', checked)}
                  className="mt-1.5 border-yellow-500/60 data-[state=checked]:bg-yellow-500 h-5 w-5"
                  disabled={submitting}
                />
                <Label 
                  htmlFor="vehicle-confirmed" 
                  className="text-yellow-200 text-sm cursor-pointer flex-1 leading-relaxed font-medium"
                >
                  Ich bestätige, dass der Tankbeleg für das Fahrzeug <strong className="text-yellow-100 bg-yellow-500/20 px-2 py-1 rounded">{vehiclePlate}</strong> ist und alle Angaben korrekt sind.
                </Label>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-700/50">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700/50 h-11 font-medium"
              >
                {t('fuel_cancel')}
              </Button>
              <Button
                onClick={handleVehicleConfirm}
                disabled={!formData.vehicle_confirmed}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-40 h-11 font-semibold shadow-lg text-base"
              >
                <ChevronRight className="w-5 h-5 mr-2" />
                Weiter
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Tankdetails */}
        {step === 2 && (
          <div className="space-y-5 mt-6">
            <p className="text-blue-300 text-xs uppercase tracking-widest font-semibold opacity-80">
              Schritt 2: Tankdetails eingeben
            </p>

            {/* Info-Box: Tour & Fahrzeug */}
            <div className="bg-gradient-to-r from-green-500/20 to-teal-500/20 border border-green-500/40 rounded-xl p-4 backdrop-blur-sm shadow-md">
              <div className="space-y-2">
                <p className="text-green-300 text-sm flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span><span className="font-semibold">{t('fuel_vehicle')}</span></span>
                </p>
                <p className="text-green-100 text-base font-semibold ml-7 font-mono">{vehiclePlate}</p>
              </div>
            </div>

            {/* Liter */}
             <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
               <Label className="text-slate-200 flex items-center gap-2 mb-3 font-semibold text-sm">
                 <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                   <Droplet className="w-4 h-4 text-blue-400" />
                 </div>
                 {t('fuel_liters')} *
               </Label>
               <Input
                 type="number"
                 step="0.01"
                 min="0.01"
                 placeholder="z.B. 45.5"
                 value={formData.liters}
                 onChange={(e) => handleInputChange('liters', e.target.value)}
                 className="bg-slate-900/70 border-slate-600/50 text-white text-base font-semibold h-11 focus:border-blue-500/50 focus:ring-blue-500/20"
                 disabled={submitting}
               />
               <p className="text-slate-400 text-xs mt-2">{t('fuel_liters_min')}</p>
             </div>

            {/* Betrag */}
             <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
               <Label className="text-slate-200 flex items-center gap-2 mb-3 font-semibold text-sm">
                 <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                   <Euro className="w-4 h-4 text-emerald-400" />
                 </div>
                 {t('fuel_amount')} *
               </Label>
               <Input
                 type="number"
                 step="0.01"
                 min="0.01"
                 placeholder="z.B. 75.50"
                 value={formData.amount}
                 onChange={(e) => handleInputChange('amount', e.target.value)}
                 className="bg-slate-900/70 border-slate-600/50 text-white text-base font-semibold h-11 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                 disabled={submitting}
               />
               {pricePerLiter && (
                 <p className="text-emerald-400/80 text-sm mt-2 font-medium">
                   ≈ {pricePerLiter} € / Liter
                 </p>
               )}
             </div>

            {/* Zahlungsart */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <Label className="text-slate-200 mb-3 block font-semibold text-sm">{t('fuel_payment_method')} *</Label>
              <Select 
                value={formData.payment_method} 
                onValueChange={(val) => handleInputChange('payment_method', val)}
                disabled={submitting}
              >
                <SelectTrigger className="bg-slate-900/70 border-slate-600/50 text-white h-11 focus:border-purple-500/50 focus:ring-purple-500/20">
                  <SelectValue placeholder={t('fuel_select_payment')} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="eigenes_geld">{t('fuel_own_money')}</SelectItem>
                  <SelectItem value="firmenkarte">{t('fuel_company_card')}</SelectItem>
                  <SelectItem value="bar">{t('fuel_payment_cash')}</SelectItem>
                  <SelectItem value="kreditkarte">{t('fuel_payment_credit')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* KM-Stand */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <Label className="text-slate-200 flex items-center gap-2 mb-3 font-semibold text-sm">
                <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Gauge className="w-4 h-4 text-orange-400" />
                </div>
                {t('fuel_mileage')} *
              </Label>
              <Input
                type="number"
                min="1"
                placeholder="z.B. 125430"
                value={formData.mileage}
                onChange={(e) => handleInputChange('mileage', e.target.value)}
                className="bg-slate-900/70 border-slate-600/50 text-white text-base font-semibold h-11 focus:border-orange-500/50 focus:ring-orange-500/20"
                disabled={submitting}
              />
              <p className="text-slate-400 text-xs mt-2">{t('fuel_km_after')}</p>
            </div>

            {/* Foto Upload - OPTIONAL */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 rounded-xl p-4 border border-slate-700/50">
              <Label className="text-slate-200 mb-3 block flex items-center gap-2 font-semibold text-sm">
                <Upload className="w-4 h-4 text-slate-400" />
                {t('fuel_photo')} 
                <span className="text-xs text-slate-500 font-normal">(Optional)</span>
              </Label>
              {formData.receipt_photo_url ? (
                <div className="space-y-2">
                  <div className="relative">
                    <img 
                      src={formData.receipt_photo_url} 
                      alt="Tankbeleg" 
                      className="w-full h-32 object-contain rounded-lg border border-slate-600 bg-slate-900/50"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePhotoUpload}
                    disabled={uploading || submitting}
                    className="w-full border-slate-600 text-slate-300 text-xs"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        {t('fuel_uploading')}
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3 mr-2" />
                        {t('fuel_photo_new')}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handlePhotoUpload}
                  disabled={uploading || submitting}
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 h-20 flex flex-col gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-xs">{t('fuel_uploading')}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      <div className="text-center text-xs">
                        <div>{t('fuel_take_photo')}</div>
                        <div className="text-slate-400">{t('fuel_landscape')}</div>
                      </div>
                    </>
                  )}
                </Button>
              )}
              <p className="text-slate-400 text-xs mt-2">
                {t('fuel_photo_instructions')}
              </p>
            </div>

            {/* Status Info */}
            {submitting && (
              <div className="bg-blue-500/20 border border-blue-500/40 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span className="text-blue-300 text-sm">{t('fuel_submitting')}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-700">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Zurück
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !formData.liters || !formData.amount || !formData.mileage}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('fuel_sending')}
                  </>
                ) : (
                  <>
                    <Fuel className="w-4 h-4 mr-2" />
                    {t('fuel_submit')}
                  </>
                )}
              </Button>
            </div>

            {/* Debug Info (nur im Entwicklungsmodus) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 p-2 bg-slate-900/50 border border-slate-600 rounded text-xs">
                <details>
                  <summary className="cursor-pointer text-slate-400">Debug Info</summary>
                  <pre className="mt-2 text-slate-400 overflow-auto">
                    {JSON.stringify({
                      tourId: tour.id,
                      tourIdField: tour.tour_id,
                      licensePlate: tour.license_plate,
                      driverEmail: driverEmail
                    }, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}