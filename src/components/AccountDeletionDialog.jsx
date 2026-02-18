import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Building, AlertTriangle, Loader2 } from "lucide-react";
import { t } from "@/components/utils/i18n";
import supabase from "@/components/supabaseClient";

export default function AccountDeletionDialog({ open, onClose }) {
  const [companyData, setCompanyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadCompanyData();
    }
  }, [open]);

  const loadCompanyData = async () => {
    setIsLoading(true);
    try {
      const driverData = JSON.parse(localStorage.getItem('driver_data') || '{}');
      const companyId = driverData.company_id;

      if (!companyId) {
        setCompanyData({ name: 'Keine Firma', email: 'support@firma.de' });
        setIsLoading(false);
        return;
      }

      // Lade Firma-Daten direkt aus companies Tabelle (RLS schützt)
      const { data, error } = await supabase
        .from('companies')
        .select('id, company_name, company_email')
        .eq('id', companyId)
        .single();

      if (error) throw error;

      setCompanyData({
        name: data.company_name || 'Ihre Firma',
        email: data.company_email || 'support@firma.de'
      });
    } catch (error) {
      console.error('Error loading company data:', error);
      setCompanyData({ name: 'Ihre Firma', email: 'support@firma.de' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailContact = () => {
    const subject = encodeURIComponent('Account-Löschung beantragen');
    const body = encodeURIComponent(`Hallo,\n\nich möchte meinen Fahrer-Account löschen lassen.\n\nMeine Daten:\nName: ${JSON.parse(localStorage.getItem('driver_data') || '{}').full_name}\nEmail: ${JSON.parse(localStorage.getItem('driver_data') || '{}').email}\n\nBitte bestätigen Sie die Löschung meines Accounts.\n\nVielen Dank`);
    window.location.href = `mailto:${companyData?.email}?subject=${subject}&body=${body}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            Account löschen
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Um Ihren Account zu löschen, kontaktieren Sie bitte Ihre Firma
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Firma Info */}
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <Building className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Firma</p>
                  <p className="text-white font-semibold">{companyData?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Kontakt Email</p>
                  <p className="text-white font-semibold">{companyData?.email}</p>
                </div>
              </div>
            </div>

            {/* Info Text */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-amber-300 text-sm">
                ⚠️ Nur Ihre Firma kann Ihren Account löschen. Kontaktieren Sie sie per Email.
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleEmailContact}
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
              >
                <Mail className="w-5 h-5 mr-2" />
                Email senden
              </Button>

              <Button
                onClick={onClose}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 h-12"
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}