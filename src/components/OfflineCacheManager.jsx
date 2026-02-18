import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trash2, Download, CheckCircle2, XCircle, 
  Calendar, MapPin, Loader2, Database, Wifi, WifiOff
} from "lucide-react";
import { offlineManager } from './OfflineManager';
import { toast } from "sonner";
import moment from "moment";

export default function OfflineCacheManager({ tours = [], isOnline }) {
  const [cachedTours, setCachedTours] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCachedTours();
  }, []);

  const loadCachedTours = async () => {
    try {
      const cached = await offlineManager.getTours();
      setCachedTours(cached);
    } catch (error) {
      console.error('Error loading cached tours:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCacheTour = async (tour) => {
    try {
      await offlineManager.saveTours([tour]);
      toast.success(`Tour #${tour.tour_number || tour.id.substring(0, 8)} für Offline gespeichert`);
      await loadCachedTours();
    } catch (error) {
      console.error('Error caching tour:', error);
      toast.error('Fehler beim Speichern');
    }
  };

  const handleClearCache = async () => {
    try {
      await offlineManager.clearCache();
      setCachedTours([]);
      toast.success('Offline-Cache geleert');
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const isTourCached = (tourId) => {
    return cachedTours.some(t => t.id === tourId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Übersicht */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            Offline-Speicher Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400 text-sm">Touren gespeichert</span>
              </div>
              <p className="text-2xl font-bold text-white">{cachedTours.length}</p>
            </div>
            
            <div className="bg-slate-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-orange-400" />
                )}
                <span className="text-slate-400 text-sm">Verbindung</span>
              </div>
              <p className="text-lg font-semibold text-white">
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>

          {cachedTours.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              className="w-full border-red-600 text-red-400 hover:bg-red-600/20"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Cache leeren
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Gespeicherte Touren */}
      {cachedTours.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">
              Offline verfügbare Touren
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cachedTours.map(tour => (
              <div 
                key={tour.id}
                className="bg-slate-900/50 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white text-sm font-medium">
                      Tour #{tour.tour_number || tour.id.substring(0, 8)}
                    </p>
                    <Badge className="bg-green-500/20 text-green-300 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Gecached
                    </Badge>
                  </div>
                  {tour.tour_date && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {moment(tour.tour_date).format('DD.MM.YYYY')}
                    </div>
                  )}
                  {tour.pickup_address && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <MapPin className="w-3 h-3" />
                      {tour.pickup_address.substring(0, 40)}...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Verfügbare Touren zum Cachen */}
      {isOnline && tours.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">
              Touren für Offline speichern
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tours
              .filter(tour => !isTourCached(tour.id))
              .map(tour => (
                <div 
                  key={tour.id}
                  className="bg-slate-900/50 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium mb-1">
                      Tour #{tour.tour_number || tour.id.substring(0, 8)}
                    </p>
                    {tour.tour_date && (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {moment(tour.tour_date).format('DD.MM.YYYY')}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleCacheTour(tour)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Speichern
                  </Button>
                </div>
              ))}
            {tours.filter(tour => !isTourCached(tour.id)).length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">
                Alle Touren sind bereits gespeichert
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}