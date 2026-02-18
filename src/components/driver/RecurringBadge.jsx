import React from "react";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

export default function RecurringBadge({ tour, size = "default", showDays = true }) {
  if (!tour?.is_recurring_instance) return null;

  // Tour-Datum formatieren (nur Wochentag anzeigen)
  const tourDate = tour.tour_date ? new Date(tour.tour_date).toLocaleDateString('de-DE', { weekday: 'long' }) : '';

  return (
    <div className="space-y-1">
      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
        <RefreshCw className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} mr-1`} />
        Wiederkehrende Tour
      </Badge>
      
      {showDays && tourDate && (
        <div className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-slate-400`}>
          <span className="text-purple-300 font-medium">{tourDate}</span>
        </div>
      )}
    </div>
  );
}