import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle } from "lucide-react";
import { t } from "@/components/utils/i18n";
import FuelReportModal from "./FuelReportModal";

export default function FuelReportButton({ tour, onUpdate }) {
  const [modalOpen, setModalOpen] = useState(false);

  // 🔴 KRITISCH: Prüfe ob tour existiert UND ob es die benötigten Felder hat
  if (!tour) {
    return (
      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{t('fuel_no_tour_data')}</span>
        </div>
      </div>
    );
  }

  // 🔴 Sicherheitsprüfung für alle benötigten Felder
  const hasValidTour = tour && (tour.id || tour.tour_id);
  const hasFuelReportId = tour.fuel_report_id;
  
  // 🟡 ACHTUNG: fuel_report_status könnte undefined sein!
  const fuelReportStatus = tour.fuel_report_status; // Kann undefined sein!
  
  if (!hasValidTour) {
    return (
      <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-2 text-yellow-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{t('fuel_invalid_tour')}</span>
        </div>
      </div>
    );
  }

  // Zeige Button nur bei picked_up oder in_transit
  if (!['picked_up', 'in_transit'].includes(tour.status)) {
    return null;
  }

  // 🔴 KORREKTUR: Prüfe ob fuel_report_status existiert BEVOR du darauf zugreifst
  const isFuelReportSubmitted = hasFuelReportId && 
    (!fuelReportStatus || fuelReportStatus !== 'gesperrt');

  if (isFuelReportSubmitted) {
    return (
      <>
        <div className="bg-green-500/10 border border-green-500/40 rounded-lg p-3 text-center mb-3">
          <div className="flex items-center justify-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">{t('fuel_submitted')}</span>
          </div>
          {fuelReportStatus && (
            <p className="text-green-300/80 text-xs mt-1">
              Status: {fuelReportStatus === 'eingereicht' ? t('fuel_checking') : fuelReportStatus}
            </p>
          )}
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-semibold shadow-lg text-white"
        >
          {t('fuel_edit_report')}
        </Button>

        <FuelReportModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          tour={tour}
          onUpdate={onUpdate}
          isEditing={true}
        />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={() => setModalOpen(true)}
        size="sm"
        className="w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 font-medium shadow-lg text-white text-xs px-3 py-1.5"
      >
        Tankvorgang starten
      </Button>

      <FuelReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tour={tour}
        onUpdate={onUpdate}
      />
    </>
  );
}