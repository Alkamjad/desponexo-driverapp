import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/components/authClient";
import { useOfflineStatus } from "@/components/hooks/useOfflineStatus";
import ConnectionStatus from "@/components/ConnectionStatus";
import OfflineCacheManager from "@/components/OfflineCacheManager";
import LoadingScreen from "@/components/LoadingScreen";

export default function OfflineCache() {
  const navigate = useNavigate();
  const isOnline = useOfflineStatus();
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTours();
  }, []);

  const loadTours = async () => {
    const driverId = localStorage.getItem('driver_id');
    if (!driverId) {
      navigate(createPageUrl('Dashboard'));
      return;
    }

    try {
      const data = await authClient.getDriverTours(driverId);
      setTours(data || []);
    } catch (error) {
      console.error('Error loading tours:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Lade Touren..." />;
  }

  return (
    <div className="min-h-screen pb-24">
      <ConnectionStatus isOnline={isOnline} />

      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 pt-8 pb-12">
        <div className="flex items-center gap-4 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Dashboard'))}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Offline-Speicher</h1>
            <p className="text-emerald-100 text-sm">Touren für Offline-Nutzung verwalten</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10">
        <OfflineCacheManager tours={tours} isOnline={isOnline} />
      </div>
    </div>
  );
}