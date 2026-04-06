import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, CheckCircle2, Loader2, Upload, X, FileSignature, AlertTriangle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/components/utils/imageCompression";
import { offlineManager } from "@/components/OfflineManager";
import { callFunction } from "@/components/utils/callFunction";
import FullscreenSignature from "./FullscreenSignature";
import { t } from "@/components/utils/i18n";

const PHOTO_TYPES = {
  ware_mit_hausnummer: "Ware mit Hausnummer",
  ware_an_der_tuer: "Ware an der Tür",
  ware_im_lager: "Ware im Lager",
  lieferschein_mit_ware: "Lieferschein mit Ware"
};

const CONDITION_OPTIONS = {
  einwandfrei: { label: "✓ Einwandfrei", color: "text-green-400" },
  leichte_schaeden: { label: "⚠️ Leichte Schäden", color: "text-yellow-400" },
  beschaedigt: { label: "❌ Beschädigt", color: "text-red-400" }
};

export default function TourDocumentationDialog({ 
  open, 
  onClose, 
  onSubmit, 
  requirements,
  tourId,
  stopNumber = null // Für Multi-Stop Dokumentation
}) {
  // Signature State
  const [signatureName, setSignatureName] = useState("");
  const [signatureData, setSignatureData] = useState(null);
  const [showFullscreenSignature, setShowFullscreenSignature] = useState(false);
  
  // Photos State
  const [photos, setPhotos] = useState({});
  
  // Condition Report State
  const [condition, setCondition] = useState("");
  const [damagePhoto, setDamagePhoto] = useState(null);
  
  // Loading State
   const [isUploading, setIsUploading] = useState(false);
   const [uploadProgress, setUploadProgress] = useState("");
   const [offlineSaved, setOfflineSaved] = useState(false);

  // File Input Refs
  const photoInputRefs = useRef({});
  const damagePhotoRef = useRef();

  // Validierung
  const isValid = () => {
    if (!requirements) return false;
    
    if (requirements.signature_required && (!signatureData || !signatureName.trim())) {
      return false;
    }

    if (requirements.photo_requirements?.length > 0) {
      for (const req of requirements.photo_requirements) {
        if (req.required && !photos[req.type]) {
          return false;
        }
      }
    }

    if (requirements.condition_report_required) {
      if (!condition) return false;
      if (condition === 'beschaedigt' && !damagePhoto) return false;
    }

    return true;
  };

  const getProgress = () => {
    if (!requirements) return { completed: 0, total: 0 };
    
    let completed = 0;
    let total = 0;

    if (requirements.signature_required) {
      total++;
      if (signatureData && signatureName.trim()) completed++;
    }

    if (requirements.photo_requirements?.length > 0) {
      requirements.photo_requirements.forEach(req => {
        if (req.required) {
          total++;
          if (photos[req.type]) completed++;
        }
      });
    }

    if (requirements.condition_report_required) {
      total++;
      if (condition && (condition !== 'beschaedigt' || damagePhoto)) completed++;
    }

    return { completed, total };
  };

  const progress = getProgress();

  // Upload über Backend-Funktion
   const uploadToSupabase = async (file, type) => {
     try {
       // Komprimiere Bild
       const compressed = await compressImage(file, 0.8, 1920);

       // Erstelle FormData
       const formData = new FormData();
       formData.append('file', compressed);
       formData.append('tour_id', tourId);
       formData.append('file_type', type);

       // Upload über Backend
       const result = await callFunction('uploadDocumentationFile', formData);

       if (!result.success) {
         throw new Error(result.error || 'Upload failed');
       }

       return result.file_url;
     } catch (err) {
       console.error('Upload error:', err);
       throw err;
     }
   };

  // Signature speichern (von Fullscreen)
  const handleSignatureSave = ({ signatureData: data, signatureName: name }) => {
    setSignatureData(data);
    setSignatureName(name);
  };

  // Photo Handler
  const handlePhotoCapture = async (type, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Datei zu groß (max 10MB)");
      return;
    }

    setPhotos(prev => ({
      ...prev,
      [type]: {
        file,
        preview: URL.createObjectURL(file)
      }
    }));
  };

  const removePhoto = (type) => {
    if (photos[type]?.preview) {
      URL.revokeObjectURL(photos[type].preview);
    }
    setPhotos(prev => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });
  };

  // Damage Photo Handler
  const handleDamagePhotoCapture = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Datei zu groß (max 10MB)");
      return;
    }

    setDamagePhoto({
      file,
      preview: URL.createObjectURL(file)
    });
  };

  const removeDamagePhoto = () => {
    if (damagePhoto?.preview) {
      URL.revokeObjectURL(damagePhoto.preview);
    }
    setDamagePhoto(null);
  };

  // Finale Submission
  const handleSubmit = async () => {
    if (!isValid()) {
      toast.error("Bitte alle erforderlichen Nachweise erbringen");
      return;
    }

    setIsUploading(true);
    const isOnline = navigator.onLine;

    let documentationCompleted = {};
    try {
      documentationCompleted = {
        completed_at: new Date().toISOString()
      };

      // 1. Signature - Online Upload oder Offline als DataURL
      if (requirements.signature_required && signatureData) {
        setUploadProgress("Unterschrift wird erfasst...");

        if (!isOnline) {
          // Offline: Speichere als Base64/DataURL
          documentationCompleted.signature = {
            image_url: signatureData, // DataURL
            signee_name: signatureName.trim(),
            timestamp: new Date().toISOString()
          };
        } else {
          // Online: Upload zu Supabase
          const blob = await fetch(signatureData).then(r => r.blob());
          const signatureFile = new File([blob], 'signature.png', { type: 'image/png' });
          const signatureUrl = await uploadToSupabase(signatureFile, 'signature');

          documentationCompleted.signature = {
            image_url: signatureUrl,
            signee_name: signatureName.trim(),
            timestamp: new Date().toISOString()
          };
        }
      }

      // 2. Photos - Online Upload oder Offline als DataURL
      if (requirements.photo_requirements?.length > 0) {
        documentationCompleted.photos = [];

        for (const req of requirements.photo_requirements) {
          if (photos[req.type]) {
            setUploadProgress(`${req.label} wird erfasst...`);

            if (!isOnline) {
              // Offline: Speichere als Preview URL
              documentationCompleted.photos.push({
                type: req.type,
                label: req.label,
                image_url: photos[req.type].preview,
                timestamp: new Date().toISOString()
              });
            } else {
              // Online: Upload zu Supabase
              const photoUrl = await uploadToSupabase(photos[req.type].file, req.type);

              documentationCompleted.photos.push({
                type: req.type,
                label: req.label,
                image_url: photoUrl,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }

      // 3. Condition Report
      if (requirements.condition_report_required && condition) {
        documentationCompleted.condition_report = {
          status: condition,
          timestamp: new Date().toISOString()
        };

        if (condition === 'beschaedigt' && damagePhoto) {
          setUploadProgress("Schadens-Foto wird erfasst...");

          if (!isOnline) {
            // Offline: Speichere Preview URL
            documentationCompleted.condition_report.damage_photo_url = damagePhoto.preview;
          } else {
            // Online: Upload zu Supabase
            const damageUrl = await uploadToSupabase(damagePhoto.file, 'damage');
            documentationCompleted.condition_report.damage_photo_url = damageUrl;
          }
        }
      }

      // OFFLINE: Speichere in Sync Queue mit allen Daten
      if (!isOnline) {
        console.log('📡 Offline - Speichere Dokumentation in Sync Queue', documentationCompleted);
        await offlineManager.addToSyncQueue({
          type: 'upload_documentation',
          data: {
            tour_id: tourId,
            driver_id: localStorage.getItem('driver_id'),
            documentation_completed: documentationCompleted
          },
          timestamp: new Date().toISOString()
        });

        toast.success('Dokumentation erfasst - wird gesendet wenn online');
        setIsUploading(false);
        setUploadProgress("");
        // 🔥 Rufe onSubmit auf, damit TourActionCard die Backend-Funktion aufruft
        if (onSubmit) {
          onSubmit(documentationCompleted);
        }
        handleClose();
        return;
      }

      // ONLINE: Rufe onSubmit auf → TourActionCard sendet an Backend-Funktion
      if (onSubmit) {
        onSubmit(documentationCompleted);
      }

      toast.success("Dokumentation erfolgreich hochgeladen!");
      setIsUploading(false);
      setUploadProgress("");
      handleClose()

      } catch (error) {
      console.error('Dokumentation Fehler:', error);

      // FALLBACK: Bei Online-Fehler in Offline-Queue speichern
      if (isOnline) {
        try {
          console.log('💾 Online-Fehler - versuche in Offline-Queue zu speichern');
          await offlineManager.addToSyncQueue({
            type: 'upload_documentation',
            data: {
              tour_id: tourId,
              stop_number: stopNumber,
              documentation_completed: documentationCompleted
            },
            timestamp: new Date().toISOString()
          });
          toast.success('Dokumentation gespeichert - wird später erneut versendet');
          setOfflineSaved(true);
        } catch (fallbackError) {
          toast.error("Fehler: " + error.message);
        }
      } else {
        toast.error("Fehler: " + error.message);
      }
      } finally {
      setIsUploading(false);
      setUploadProgress("");
      }
      };

  const handleClose = () => {
    // Cleanup
    Object.values(photos).forEach(photo => {
      if (photo?.preview) URL.revokeObjectURL(photo.preview);
    });
    if (damagePhoto?.preview) URL.revokeObjectURL(damagePhoto.preview);
    
    onClose();
  };

  if (!requirements || Object.keys(requirements).length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-2xl max-h-[95vh] overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 text-white border-slate-700/50 mx-0 rounded-3xl sm:rounded-xl p-5 sm:p-8 shadow-2xl">
        <DialogHeader className="pb-5 border-b border-slate-700/30">
          <DialogTitle className="text-2xl sm:text-3xl font-bold flex items-center gap-3 text-white">
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-emerald-500/40 to-teal-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileSignature className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" />
            </div>
            <span>Dokumentation {stopNumber ? `(Stop ${stopNumber})` : ''}</span>
          </DialogTitle>
          <p className="text-amber-300/70 text-xs sm:text-sm mt-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 sm:p-4">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5 text-amber-400" />
            <span className="leading-relaxed">Alle erforderlichen Nachweise bitte vor Weiterfahrt erbringen</span>
          </p>
        </DialogHeader>

        {/* Progress */}
        <div className="bg-slate-800/40 rounded-2xl p-4 sm:p-5 mb-6 border border-slate-700/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm text-slate-300 font-semibold tracking-wider">FORTSCHRITT</span>
            <span className="text-emerald-400 font-bold text-base sm:text-lg bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
              {progress.completed}/{progress.total}
            </span>
          </div>
          <div className="w-full bg-slate-700/30 rounded-full h-2 sm:h-3 overflow-hidden border border-slate-700/50">
            <div 
              className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-lg shadow-emerald-500/50"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5 mt-6">
           {/* 1. Digitale Unterschrift */}
           {requirements.signature_required && (
             <div className="space-y-4 bg-slate-800/30 rounded-2xl p-4 sm:p-6 border border-slate-700/30 backdrop-blur-sm">
               <Label className="text-sm sm:text-base font-bold text-white flex items-center gap-3">
                 <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-500/40 to-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                   <span className="text-blue-300 text-lg">✍️</span>
                 </div>
                 <span>{t('doc_signature_required')}</span>
               </Label>

               {!signatureData ? (
                 <Button
                   onClick={() => setShowFullscreenSignature(true)}
                   className="w-full h-32 sm:h-40 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl text-base sm:text-lg font-semibold shadow-xl"
                 >
                   <div className="text-center">
                     <FileSignature className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3" />
                     <p>{t('doc_signature_tap')}</p>
                     <p className="text-xs sm:text-sm text-blue-200 mt-2">{t('doc_signature_fullscreen')}</p>
                   </div>
                 </Button>
               ) : (
                 <div className="space-y-3">
                   <div className="border-2 border-green-500/30 rounded-2xl p-3 bg-green-500/5 overflow-hidden">
                     <img src={signatureData} alt="Unterschrift" className="w-full h-24 object-contain" />
                   </div>
                   <div className="flex items-center justify-between bg-green-500/10 px-4 py-3 rounded-xl border border-green-500/30">
                     <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                       <CheckCircle2 className="w-5 h-5" />
                       <span>{signatureName}</span>
                     </div>
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => {
                         setSignatureData(null);
                         setSignatureName("");
                       }}
                       className="text-slate-400 hover:text-white hover:bg-slate-700"
                     >
                       <X className="w-4 h-4 mr-1" />
                       {t('doc_signature_change')}
                     </Button>
                   </div>
                 </div>
               )}
            </div>
           )}

           <FullscreenSignature
             open={showFullscreenSignature}
             onClose={() => setShowFullscreenSignature(false)}
             onSave={handleSignatureSave}
             initialName={signatureName}
           />

          {/* 2. Fotos */}
          {requirements.photo_requirements?.map((req) => (
            <div key={req.type} className="space-y-4 bg-slate-800/30 rounded-2xl p-4 sm:p-6 border border-slate-700/30 backdrop-blur-sm">
              <Label className="text-sm sm:text-base font-bold text-white flex items-center gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-cyan-500/40 to-cyan-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-300 text-lg">📸</span>
                </div>
                <span>{req.label}</span>
                {req.required && <span className="text-red-400 ml-1">*</span>}
              </Label>

              {!photos[req.type] ? (
                <>
                  <input
                    ref={(el) => photoInputRefs.current[req.type] = el}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoCapture(req.type, e)}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full h-32 sm:h-40 border-dashed border-2 border-slate-600 hover:border-cyan-400 bg-slate-900/70 hover:bg-slate-800 transition-all rounded-2xl"
                    onClick={() => photoInputRefs.current[req.type]?.click()}
                  >
                    <div className="text-center">
                      <Camera className="w-7 h-7 sm:w-8 sm:h-8 mx-auto mb-2 text-cyan-400" />
                      <p className="text-xs sm:text-sm font-medium text-slate-200">{t('doc_take_photo')}</p>
                    </div>
                  </Button>
                </>
              ) : (
                <div className="relative rounded-2xl overflow-hidden">
                  <img
                    src={photos[req.type].preview}
                    alt={req.label}
                    className="w-full h-40 sm:h-48 object-cover"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 rounded-full h-8 w-8"
                    onClick={() => removePhoto(req.type)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <div className="absolute bottom-2 left-2 bg-gradient-to-r from-green-600 to-teal-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 font-semibold shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('doc_captured')}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* 3. Zustandsbericht */}
          {requirements.condition_report_required && (
            <div className="space-y-4 bg-slate-800/30 rounded-2xl p-4 sm:p-6 border border-slate-700/30 backdrop-blur-sm">
              <Label className="text-sm sm:text-base font-bold text-white flex items-center gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-purple-500/40 to-purple-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-300 text-lg">📋</span>
                </div>
                <span>{t('doc_condition_report')}</span>
              </Label>

              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="bg-slate-900/70 border-slate-600 h-11 text-sm sm:text-base font-medium rounded-xl">
                  <SelectValue placeholder={t('doc_select_condition')} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION_OPTIONS).map(([key, opt]) => (
                    <SelectItem key={key} value={key}>
                      <span className={opt.color}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Schadens-Foto bei Beschädigung */}
              {condition === 'beschaedigt' && (
                <div className="space-y-2 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <Label className="text-red-300 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t('doc_damage_photo_required')} *
                  </Label>

                  {!damagePhoto ? (
                    <>
                      <input
                        ref={damagePhotoRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleDamagePhotoCapture}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        className="w-full h-20 border-dashed border-2 border-red-500/50 hover:border-red-500 bg-slate-900/70 hover:bg-slate-800"
                        onClick={() => damagePhotoRef.current?.click()}
                      >
                        <div className="text-center">
                          <Camera className="w-6 h-6 mx-auto mb-1 text-red-400" />
                          <p className="text-sm text-red-300">{t('doc_take_damage_photo')}</p>
                        </div>
                      </Button>
                    </>
                  ) : (
                    <div className="relative">
                      <img
                        src={damagePhoto.preview}
                        alt="Schaden"
                        className="w-full h-40 sm:h-48 object-cover rounded-2xl"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 right-2"
                        onClick={removeDamagePhoto}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>



        {/* Actions */}
         <div className="flex gap-3 pt-6 border-t border-slate-700/30">
           <Button
             variant="outline"
             onClick={handleClose}
             disabled={isUploading}
             className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700/40 h-11 sm:h-12 font-semibold rounded-xl text-sm sm:text-base"
           >
             {t('doc_cancel')}
           </Button>
           <Button
             onClick={handleSubmit}
             disabled={!isValid() || isUploading}
             className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 h-11 sm:h-12 font-semibold shadow-lg text-sm sm:text-base rounded-xl text-white"
           >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                <span className="hidden sm:inline">{uploadProgress || t('doc_uploading')}</span>
                <span className="sm:hidden text-xs">{uploadProgress?.split(' ')[0] || t('doc_loading_short')}</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                <span>{t('doc_submit')}</span>
              </>
            )}
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}