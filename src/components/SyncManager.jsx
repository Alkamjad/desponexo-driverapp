import { useEffect, useRef } from "react";
import { offlineManager } from "./OfflineManager";
import { authClient } from "./authClient";
import { toast } from "sonner";
import { callFunction } from "./utils/callFunction";
import supabase from "./supabaseClient";

export default function SyncManager({ driverId, isOnline, onSyncComplete }) {
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!driverId || !isOnline || syncingRef.current) return;

    const syncData = async () => {
      syncingRef.current = true;

      try {
        // Lade Queue
        const queue = await offlineManager.getSyncQueue();
        
        if (queue.length === 0) {
          syncingRef.current = false;
          return;
        }

        console.log(`🔄 Synchronisiere ${queue.length} ausstehende Updates...`);
        toast.loading(`Synchronisiere ${queue.length} Updates...`, { id: 'sync' });

        let successCount = 0;
        let errorCount = 0;

        // Verarbeite Queue-Items sequenziell
         for (const item of queue) {
           try {
             let endpoint = '';
             let payload = {};

             if (item.type === 'update_tour_status') {
               endpoint = 'updateTourStatus';
               payload = item.data || item;
             } else if (item.type === 'upload_documentation') {
               endpoint = 'uploadTourDocumentation';
               payload = item.data || item;
             } else if (item.type === 'submit_fuel_report') {
               endpoint = 'submitFuelReport';
               payload = item.data || item;
             } else {
               // Unbekannter Typ - löschen und weitermachen
               console.warn('Unbekannter Queue-Typ:', item.type);
               await offlineManager.deleteQueueItem(item.id);
               continue;
             }

             // 🔄 Nutze callFunction Wrapper (mit JWT + Error-Normalisierung)
             const result = await callFunction(endpoint, payload);

             if (result.success) {
               await offlineManager.deleteQueueItem(item.id);
               successCount++;
               console.log(`✅ ${endpoint} synchronisiert:`, payload.tour_id || item.id);
             } else {
               errorCount++;
               console.error(`${endpoint} fehlgeschlagen:`, result.error);
               // Fehler = Item bleibt in Queue für nächsten Versuch
             }
           } catch (error) {
             errorCount++;
             console.error('Sync error bei Item', item.id, ':', error.message);
             // Bei Fehler: Item bleibt in Queue für nächsten Versuch
           }
         }

        // Feedback
        if (successCount > 0) {
          toast.success(`✅ ${successCount} Updates synchronisiert`, { id: 'sync' });
          
          // Lade aktuelle Touren vom Server
          const tours = await authClient.getDriverTours(driverId);
          await offlineManager.saveTours(tours);
          
          if (onSyncComplete) {
            onSyncComplete(tours);
          }
        }

        if (errorCount > 0) {
          toast.error(`⚠️ ${errorCount} Updates fehlgeschlagen`, { id: 'sync' });
        }

      } catch (error) {
        console.error('Sync Manager Error:', error);
        toast.error('Synchronisierung fehlgeschlagen', { id: 'sync' });
      } finally {
        syncingRef.current = false;
      }
    };

    // Starte Sync nach 1 Sekunde Online-Zeit
    const timer = setTimeout(syncData, 1000);
    return () => clearTimeout(timer);
    
  }, [driverId, isOnline, onSyncComplete]);

  return null;
}