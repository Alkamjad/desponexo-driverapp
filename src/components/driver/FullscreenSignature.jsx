import React, { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, RotateCcw } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { t } from "@/components/utils/i18n";

export default function FullscreenSignature({ open, onClose, onSave, initialName = "" }) {
  const signaturePadRef = useRef();
  const [signatureName, setSignatureName] = useState(initialName);
  const [signatureData, setSignatureData] = useState(null);

  const handleSignatureEnd = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      setSignatureData(signaturePadRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    signaturePadRef.current?.clear();
    setSignatureData(null);
  };

  const handleSave = () => {
    if (signatureData && signatureName.trim()) {
      onSave({
        signatureData,
        signatureName: signatureName.trim()
      });
      onClose();
    }
  };

  const handleClose = () => {
    clearSignature();
    setSignatureName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none m-0 p-0 bg-slate-900 border-0 rounded-none" aria-describedby="signature-description">
        <div id="signature-description" className="sr-only">
          Digitale Unterschrift erfassen
        </div>
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-slate-900 via-slate-900/95 to-transparent z-10 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white text-lg sm:text-xl font-bold">{t('doc_signature_title')}</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">{t('doc_signature_rotate')}</p>
            </div>
            <Button
              onClick={handleClose}
              size="icon"
              variant="ghost"
              className="text-white hover:bg-slate-800 rounded-full h-10 w-10 sm:h-12 sm:w-12"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          </div>
        </div>

        {/* Signature Canvas - Fullscreen */}
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <SignatureCanvas
            ref={signaturePadRef}
            canvasProps={{
              className: 'w-full h-full touch-none'
            }}
            onEnd={handleSignatureEnd}
          />
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent z-10 p-4 sm:p-6 space-y-4">
          {/* Name Input */}
          <div className="max-w-md mx-auto">
            <Input
              placeholder={t('doc_signature_name')}
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              className="bg-slate-800/90 border-slate-700 text-white h-12 text-base font-medium rounded-xl backdrop-blur-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 max-w-md mx-auto">
            <Button
              onClick={clearSignature}
              variant="outline"
              className="flex-1 bg-slate-800/90 border-slate-700 text-white hover:bg-slate-700 h-12 rounded-xl backdrop-blur-sm"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              {t('doc_signature_clear')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!signatureData || !signatureName.trim()}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 h-12 rounded-xl font-semibold"
            >
              <Check className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              {t('doc_signature_save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}