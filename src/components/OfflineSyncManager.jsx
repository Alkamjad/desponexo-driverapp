// OfflineSyncManager.js - Automatischer Sync wenn online
import React, { useEffect, useState } from 'react';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { getPendingRequests, updateRequestStatus, deleteRequest, incrementRetryCount } from './utils/offlineDB';
import { authClient } from './authClient';
import { toast } from 'sonner';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

const MAX_RETRIES = 3;

export default function OfflineSyncManager() {
  const { isOnline, connectionType } = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Pending Count aktualisieren
  useEffect(() => {
    const updateCount = async () => {
      const pending = await getPendingRequests();
      setPendingCount(pending.length);
    };
    
    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Automatischer Sync wenn online
  useEffect(() => {
    if (isOnline && !isSyncing && pendingCount > 0) {
      console.log('🔄 Online erkannt - starte Sync...');
      syncPendingRequests();
    }
  }, [isOnline, pendingCount]);

  const syncPendingRequests = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    console.log('📤 Starte Synchronisierung...');
    
    try {
      const pending = await getPendingRequests();
      console.log(`📋 ${pending.length} ausstehende Requests`);
      
      let successCount = 0;
      let failCount = 0;

      for (const request of pending) {
        try {
          console.log(`⏳ Verarbeite: ${request.type}`);
          
          // Request basierend auf Typ verarbeiten
          await processRequest(request);
          
          // Erfolg - aus Queue löschen
          await deleteRequest(request.id);
          successCount++;
          console.log(`✅ Erfolgreich: ${request.type}`);
          
        } catch (error) {
          console.error(`❌ Fehler bei ${request.type}:`, error);
          
          // Retry Count erhöhen
          await incrementRetryCount(request.id);
          
          // Nach MAX_RETRIES als failed markieren
          if (request.retryCount >= MAX_RETRIES - 1) {
            await updateRequestStatus(request.id, 'failed', error.message);
            console.log(`🚫 Max Retries erreicht: ${request.type}`);
          }
          
          failCount++;
        }
      }

      // Feedback
      if (successCount > 0) {
        toast.success(`✅ ${successCount} Änderungen synchronisiert`);
      }
      if (failCount > 0) {
        toast.error(`⚠️ ${failCount} Requests fehlgeschlagen`);
      }

      // Count aktualisieren
      const stillPending = await getPendingRequests();
      setPendingCount(stillPending.length);
      
    } catch (error) {
      console.error('❌ Sync-Fehler:', error);
      toast.error('Synchronisierung fehlgeschlagen');
    } finally {
      setIsSyncing(false);
    }
  };

  const processRequest = async (request) => {
    const { type, data } = request;

    switch (type) {
      case 'UPDATE_TOUR_STATUS':
        return await authClient.updateTourStatus(
          data.tourId, 
          data.status, 
          data.pieces
        );

      case 'UPDATE_TOUR_STOP':
        return await authClient.updateTourStop(
          data.tourId,
          data.stopId,
          data.updateData
        );

      case 'SUBMIT_FUEL_REPORT':
        return await authClient.submitFuelReport(data);

      default:
        throw new Error(`Unbekannter Request-Typ: ${type}`);
    }
  };

  // UI - Sync Status Badge
  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm">
        <WifiOff className="w-4 h-4" />
        <span className="text-sm font-medium">Offline</span>
        {pendingCount > 0 && (
          <span className="bg-white text-red-500 px-2 py-0.5 rounded-full text-xs font-bold">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-blue-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm font-medium">Synchronisiere...</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-orange-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm">
        <RefreshCw className="w-4 h-4" />
        <span className="text-sm font-medium">{pendingCount} ausstehend</span>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-emerald-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm">
      <Wifi className="w-4 h-4" />
      <span className="text-sm font-medium">Online</span>
    </div>
  );
}