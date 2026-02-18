import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, X } from 'lucide-react';
import { offlineManager } from './OfflineManager';
import { Button } from '@/components/ui/button';

export default function ConnectionStatus({ isOnline }) {
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    const updateQueueCount = async () => {
      try {
        const queue = await offlineManager.getSyncQueue();
        setQueueCount(queue.length);
      } catch (error) {
        console.error('Error loading queue count:', error);
      }
    };

    updateQueueCount();
    const interval = setInterval(updateQueueCount, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleClearQueue = async () => {
    await offlineManager.clearCache();
    setQueueCount(0);
  };

  // Immer anzeigen wenn offline ODER wenn etwas in der Queue ist
  if (!isOnline || queueCount > 0) {
    return (
      <div 
        className={`fixed top-0 left-0 right-0 z-50 ${
          isOnline ? 'bg-blue-600' : 'bg-amber-600'
        } text-white py-2 px-3 sm:px-4 flex items-center justify-between gap-2 shadow-lg text-xs sm:text-sm font-medium flex-wrap sm:flex-nowrap min-h-[3rem] sm:min-h-auto`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isOnline ? (
            <>
              <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 animate-spin flex-shrink-0" />
              <span className="truncate">Synchronisierung... ({queueCount})</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate">Offline{queueCount > 0 ? ` • ${queueCount} wartend` : ''}</span>
            </>
          )}
        </div>
        {queueCount > 0 && (
          <Button 
            size="sm" 
            variant="ghost"
            className="text-white hover:bg-white/20 h-7 w-7 px-0 flex-shrink-0 ml-2"
            onClick={handleClearQueue}
            title="Warteschlange löschen"
          >
            <X className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
        )}
      </div>
    );
  }

  // Online + nichts in Queue = nichts anzeigen
  return null;
}