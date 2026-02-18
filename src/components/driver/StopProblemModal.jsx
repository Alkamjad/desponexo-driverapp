import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";

export default function StopProblemModal({ open, onClose, onSubmit, stop }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    console.log('🟢 MODAL SUBMIT CLICKED', { reason, details });
    if (!reason || isSubmitting) return;
    setIsSubmitting(true);
    console.log('🟢 CALLING onSubmit...');
    try {
      await onSubmit({ reason, details });
      console.log('🟢 onSubmit SUCCESS');
      setReason("");
      setDetails("");
    } catch (error) {
      console.error('🟢 onSubmit ERROR:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      console.log('🟢 DIALOG onOpenChange:', newOpen);
      if (!newOpen && !isSubmitting) {
        onClose();
      }
    }}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            Problem melden
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <p className="text-slate-300 text-sm mb-2">
              Stop: {stop?.customer_name}
            </p>
            <p className="text-slate-400 text-xs">
              {stop?.address}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Problem-Grund *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                <SelectValue placeholder="Problem auswählen..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="kunde_nicht_erreichbar">
                  Kunde nicht erreichbar
                </SelectItem>
                <SelectItem value="falsche_adresse">
                  Falsche Adresse
                </SelectItem>
                <SelectItem value="kunde_verweigert">
                  Kunde verweigert Annahme
                </SelectItem>
                <SelectItem value="sonstiges">
                  Sonstiges
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Details</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Beschreibe das Problem..."
              className="bg-slate-900/50 border-slate-600 text-white min-h-[100px]"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300"
              onClick={onClose}
            >
              Abbrechen
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleSubmit}
              disabled={!reason || isSubmitting}
            >
              {isSubmitting ? "Wird gemeldet..." : "Problem melden"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}