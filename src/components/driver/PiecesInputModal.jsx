import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Package, Euro } from "lucide-react";

export default function PiecesInputModal({ 
  open, 
  onClose, 
  onConfirm, 
  tour,
  isUpdating 
}) {
  // Bei Multi-Stop: Anzahl Stops, sonst pieces_delivered oder 0
  const defaultPieces = tour?.is_multi_stop && tour?.stops?.length 
    ? tour.stops.length 
    : (tour?.pieces_delivered || 0);
    
  const [piecesInput, setPiecesInput] = useState(defaultPieces.toString());

  useEffect(() => {
    if (open) {
      const pieces = tour?.is_multi_stop && tour?.stops?.length 
        ? tour.stops.length 
        : (tour?.pieces_delivered || 0);
      setPiecesInput(pieces.toString());
      console.log('🔢 PiecesInputModal opened:', {
        is_multi_stop: tour?.is_multi_stop,
        stops_length: tour?.stops?.length,
        pieces_delivered: tour?.pieces_delivered,
        defaultPieces: pieces
      });
    }
  }, [open, tour]);

  const handleConfirm = () => {
    const pieces = parseInt(piecesInput) || 0;
    if (pieces < 0) return;
    onConfirm(pieces);
  };

  const pieces = parseInt(piecesInput) || 0;
  const calculatedAmount = pieces * (tour?.compensation_rate || 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            Stückzahl eingeben
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label className="text-slate-300 mb-2 block">
              Wie viele Stücke wurden geliefert?
            </Label>
            
            {tour?.is_multi_stop && tour?.stops?.length > 0 && (
              <p className="text-xs text-blue-400 mb-2">
                💡 Vorgeschlagen: {defaultPieces} (basierend auf {tour.stops.length} Stops)
              </p>
            )}

            <Input
              type="number"
              min="0"
              value={piecesInput}
              onChange={(e) => setPiecesInput(e.target.value)}
              className="bg-slate-900/50 border-slate-600 text-white text-lg h-14 text-center"
              placeholder="0"
              disabled={isUpdating}
            />
          </div>

          {/* Vergütungs-Preview */}
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm">Stückpreis:</span>
              <span className="text-white font-medium">€{tour?.compensation_rate?.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm">Stückzahl:</span>
              <span className="text-white font-medium">{pieces}</span>
            </div>
            <div className="h-px bg-emerald-500/30 my-2" />
            <div className="flex items-center justify-between">
              <span className="text-emerald-300 font-semibold">Geschätzte Vergütung:</span>
              <span className="text-emerald-400 font-bold text-xl flex items-center gap-1">
                <Euro className="w-5 h-5" />
                {calculatedAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {pieces === 0 && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 text-center">
              <p className="text-yellow-300 text-sm">
                ⚠️ Achtung: 0 Stücke bedeutet keine Vergütung
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={onClose}
              disabled={isUpdating}
            >
              Abbrechen
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleConfirm}
              disabled={isUpdating || pieces < 0}
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Package className="w-4 h-4 mr-2" />
              )}
              Bestätigen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}