import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ReturnConfirmationDialog({ open, onClose, onConfirm, quantity, description }) {
  const [collected, setCollected] = useState(true);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setCollected(true);
      setReason("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retoure bestätigt?</DialogTitle>
          <DialogDescription>
            {quantity ? `Für diesen Stop sind ${quantity}x ${description || 'Artikel'} als Retoure hinterlegt.` : 'Für diesen Stop ist eine Retoure hinterlegt.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={collected ? 'default' : 'outline'}
              className="h-10"
              onClick={() => setCollected(true)}
            >
              Ja, mitgenommen
            </Button>
            <Button
              variant={!collected ? 'default' : 'outline'}
              className="h-10"
              onClick={() => setCollected(false)}
            >
              Nein
            </Button>
          </div>

          {!collected && (
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Grund (Pflicht)</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="z.B. Kunde verweigert Retoure"
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            onClick={() => onConfirm?.({ collected, reason })}
            disabled={!collected && reason.trim().length === 0}
          >
            Bestätigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}