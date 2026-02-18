import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, FileText, Euro, Calendar, MapPin, 
  Building2, Truck, AlertTriangle, CheckCircle2, 
  Upload, Eye, Loader2, Download
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/components/utils/i18n";
import { callFunction } from "@/components/utils/callFunction";
import LoadingScreen from "@/components/LoadingScreen";

const VIOLATION_TYPE_LABELS = {
  SPEEDING: 'Geschwindigkeitsüberschreitung',
  RED_LIGHT: 'Rotlichtverstoß',
  PARKING: 'Parkverstoß',
  PHONE: 'Handyverstoß',
  DISTANCE: 'Abstandsverstoß',
  OTHER: 'Sonstiges'
};

const getStatusConfig = (status) => {
  const configs = {
    OPEN: { 
      label: 'Offen', 
      color: 'bg-yellow-500',
      bgLight: 'bg-yellow-500/10',
      textColor: 'text-yellow-400'
    },
    PAID: { 
      label: 'Bezahlt', 
      color: 'bg-green-500',
      bgLight: 'bg-green-500/10',
      textColor: 'text-green-400'
    },
    CANCELLED: { 
      label: 'Storniert', 
      color: 'bg-slate-500',
      bgLight: 'bg-slate-500/10',
      textColor: 'text-slate-400'
    }
  };
  return configs[status] || configs.OPEN;
};

export default function OrdnungswidrigkeitDetails() {
  const navigate = useNavigate();
  const [violation, setViolation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const violationId = urlParams.get('id');

  useEffect(() => {
    loadViolation();
  }, [violationId]);

  useEffect(() => {
    if (violation) {
      console.log('🔍 Violation Data:', {
        id: violation.id,
        pdf_url: violation.pdf_url,
        payment_proof_url: violation.payment_proof_url,
        status: violation.status
      });
    }
  }, [violation]);

  const loadViolation = async () => {
    if (!violationId) {
      toast.error(t('error'));
      navigate(createPageUrl('Ordnungswidrigkeiten'));
      return;
    }

    try {
      const data = await callFunction('getDriverTrafficViolations', {});
      const found = data.violations?.find(v => v.id === violationId);
      
      if (!found) {
        toast.error(t('violation_not_found'));
        navigate(createPageUrl('Ordnungswidrigkeiten'));
        return;
      }

      setViolation(found);
    } catch (error) {
      console.error('Error loading violation:', error);
      toast.error(t('violations_error_loading'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    // Direkter File-Upload Trigger statt nur Markieren
    fileInputRef.current?.click();
  };

  // Bildkomprimierung
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          let width = img.width;
          let height = img.height;
          const maxDimension = 1920;
          
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.85);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validierung
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Nur PDF, JPG oder PNG erlaubt');
      return;
    }

    setIsUploading(true);
    try {
      let uploadFile = file;
      
      // Komprimiere Bilder > 1MB
      if (file.type.startsWith('image/') && file.size > 1 * 1024 * 1024) {
        toast.info('Komprimiere Bild...');
        uploadFile = await compressImage(file);
      }

      // 1. Erst als bezahlt markieren (wenn noch OPEN)
      if (violation.status === 'OPEN') {
        const markResult = await callFunction('markTrafficViolationAsPaid', { 
          violation_id: violationId 
        });

        if (!markResult.success) {
          toast.error(markResult.error || 'Fehler beim Markieren');
          return;
        }
      }

      // 2. Dann Nachweis hochladen
      const formData = new FormData();
      formData.append('violation_id', violationId);
      formData.append('file', uploadFile);

      const data = await callFunction('uploadPaymentProof', formData);

      if (data.success) {
        toast.success('Zahlungsnachweis erfolgreich hochgeladen');
        await loadViolation();
      } else {
        toast.error(data.error || 'Fehler beim Upload');
      }
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error('Fehler beim Upload');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openPDF = (url) => {
    if (url) {
      // Öffne PDF in neuem Tab mit Download-Option
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast.error('PDF nicht verfügbar');
    }
  };

  if (isLoading) {
    return <LoadingScreen message={t('loading')} />;
  }

  if (!violation) {
    return null;
  }

  const config = getStatusConfig(violation.status);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-red-600 to-red-800 p-6 pt-8 pb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Ordnungswidrigkeiten'))}
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-white">
              {t('violation_details')}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="inline-flex flex-col items-start px-3 py-2 rounded-md bg-slate-800 border border-slate-700">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Aktenzeichen</span>
              <span className="text-sm font-mono font-semibold text-slate-300">
                {violation.reference_number || `#${violation.id.substring(0, 8)}`}
              </span>
            </div>
            <Badge className={`${config.color} text-white`}>
              {config.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-4 space-y-4">
        {/* Haupt-Info Card */}
        <Card className="border-0 shadow-xl bg-slate-800/80 backdrop-blur">
          <CardContent className="p-6 space-y-6">
            {/* Betrag */}
            <div className="text-center py-4 bg-red-500/10 rounded-xl border border-red-500/20">
              <p className="text-slate-400 text-sm mb-1">{t('violation_amount')}</p>
              <div className="text-4xl font-bold text-red-400 flex items-center justify-center gap-2">
                <Euro className="w-8 h-8" />
                {violation.amount?.toFixed(2)}
              </div>
            </div>

            {/* Details Grid */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    {t('violation_type')}
                  </p>
                  <p className="text-white font-semibold">
                    {VIOLATION_TYPE_LABELS[violation.violation_type] || violation.violation_type}
                  </p>
                </div>
              </div>

              {violation.violation_date && (
                <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {t('violation_date')}
                    </p>
                    <p className="text-white font-semibold">
                      {new Date(violation.violation_date).toLocaleDateString('de-DE', { 
                        day: '2-digit', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              )}

              {violation.due_date && violation.status === 'OPEN' && (
                <div className="flex items-start gap-3 p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">
                      {t('violation_due_date')}
                    </p>
                    <p className="text-yellow-300 font-semibold">
                      {new Date(violation.due_date).toLocaleDateString('de-DE', { 
                        day: '2-digit', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              )}

              {violation.location && (
                <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {t('violation_location')}
                    </p>
                    <p className="text-white font-semibold">{violation.location}</p>
                  </div>
                </div>
              )}

              {violation.authority && (
                <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <Building2 className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {t('violation_authority')}
                    </p>
                    <p className="text-white font-semibold">{violation.authority}</p>
                  </div>
                </div>
              )}

              {violation.vehicle_license_plate && (
                <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <Truck className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {t('violation_vehicle')}
                    </p>
                    <p className="text-white font-semibold font-mono">{violation.vehicle_license_plate}</p>
                  </div>
                </div>
              )}

              {violation.notes_company && (
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-2">
                    {t('violation_notes')}
                  </p>
                  <p className="text-slate-300 text-sm leading-relaxed">{violation.notes_company}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Als bezahlt markieren + Nachweis hochladen (kombiniert) - nur bei OPEN */}
          {violation.status === 'OPEN' && (
            <Button 
              onClick={handleMarkAsPaid}
              disabled={isUploading}
              className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold text-lg rounded-2xl shadow-lg flex items-center justify-center gap-3"
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
              Als bezahlt markieren
            </Button>
          )}

          {/* Zahlungsnachweis ansehen */}
          {violation.status === 'PAID' && violation.payment_proof_url && (
            <div className="space-y-3">
              <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-center">
                <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-300 font-semibold">
                  Zahlungsnachweis hochgeladen
                </p>
              </div>
              <Button 
                onClick={() => openPDF(violation.payment_proof_url)}
                className="w-full h-14 bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-3 border border-slate-600"
              >
                <Eye className="w-6 h-6" />
                Zahlungsnachweis ansehen
              </Button>
            </div>
          )}

          {/* Original Strafzettel PDF ansehen - GANZ UNTEN */}
          {violation.pdf_url && (
            <Button 
              onClick={() => openPDF(violation.pdf_url)}
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg rounded-2xl shadow-lg flex items-center justify-center gap-3"
            >
              <FileText className="w-6 h-6" />
              Strafzettel ansehen
            </Button>
          )}
        </div>

        {/* Hinweis für offene Strafzettel */}
        {violation.status === 'OPEN' && (
          <Card className="border-0 bg-yellow-500/10 border-yellow-500/20">
            <CardContent className="p-4">
              <p className="text-yellow-300 text-sm text-center leading-relaxed">
                ℹ️ Klicke auf "Als bezahlt markieren" und lade direkt deinen Zahlungsnachweis hoch (Foto oder PDF der Überweisung). Die Firma wird diesen prüfen.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}