import React, { useEffect, useRef, useState } from "react";
import { Navigation, AlertTriangle } from "lucide-react";
import { callFunction } from "@/components/utils/callFunction";

export default function GPSTracker({ driverId, tourId, isActive, onLocationUpdate }) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState(null);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isActive && driverId) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [isActive, driverId, tourId]);

  const startTracking = async () => {
    if (!navigator.geolocation) {
      console.error('GPS nicht verfügbar');
      setError('GPS nicht verfügbar');
      return;
    }

    console.log('🌍 GPS-Tracking wird gestartet...');
    setIsTracking(true);
    setError(null);

    // WICHTIG: Erst Permission anfordern mit getCurrentPosition
    try {
      const initialPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      // Sende erste Position sofort
      const firstLocation = {
        latitude: initialPosition.coords.latitude,
        longitude: initialPosition.coords.longitude,
        accuracy: initialPosition.coords.accuracy,
        speed: initialPosition.coords.speed,
        heading: initialPosition.coords.heading,
        timestamp: new Date().toISOString()
      };

      setLastLocation(firstLocation);
      if (onLocationUpdate) onLocationUpdate(firstLocation);

      // Sende an Server
      console.log('📍 Erste GPS-Position wird gesendet:', firstLocation);
      
      const updateData = await callFunction('updateDriverLocation', {
        driver_id: driverId,
        tour_id: tourId,
        ...firstLocation
      });
      console.log('✅ Driver status updated:', updateData.status || 'success');

    } catch (permissionError) {
      // Zeige Fehler nur wenn es wirklich verweigert wurde (code 1)
      if (permissionError.code === 1) {
        setTimeout(() => {
          setError('GPS-Berechtigung verweigert - bitte in Browser-Einstellungen erlauben');
        }, 2000);
      }
      setIsTracking(false);
      return;
    }

    // Ref für aktuelle Location (statt State, wegen Closure-Problem)
    const currentLocationRef = { current: null };

    // JETZT kontinuierliches Tracking starten
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          timestamp: new Date().toISOString()
        };
        
        currentLocationRef.current = location;
        setLastLocation(location);
        
        if (onLocationUpdate) {
          onLocationUpdate(location);
        }

        // Sende Location SOFORT an Server (nicht erst nach 30s)
        try {
          console.log('📍 GPS-Update wird gesendet');
          
          await callFunction('updateDriverLocation', {
            driver_id: driverId,
            tour_id: tourId,
            ...location
          });
          console.log('✅ GPS-Update erfolgreich');
        } catch (err) {
          console.error('❌ GPS-Update fehlgeschlagen:', err);
        }
      },
      (err) => {
        setError(getErrorMessage(err));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    // Zusätzlich: Sende Location alle 30 Sekunden (als Backup)
    intervalRef.current = setInterval(async () => {
      if (currentLocationRef.current) {
        try {
          await callFunction('updateDriverLocation', {
            driver_id: driverId,
            tour_id: tourId,
            ...currentLocationRef.current
          });
        } catch (err) {
          // Silent fail
        }
      }
    }, 30000);
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
  };

  const getErrorMessage = (err) => {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        return 'GPS-Berechtigung verweigert';
      case err.POSITION_UNAVAILABLE:
        return 'Standort nicht verfügbar';
      case err.TIMEOUT:
        return 'GPS-Timeout';
      default:
        return 'GPS-Fehler';
    }
  };

  if (!isActive) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
      error 
        ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
    }`}>
      {error ? (
        <>
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </>
      ) : (
        <>
          <Navigation className="w-4 h-4 animate-pulse" />
          <span>GPS-Tracking aktiv</span>
          {lastLocation && (
            <span className="text-xs opacity-70">
              (±{Math.round(lastLocation.accuracy || 0)}m)
            </span>
          )}
        </>
      )}
    </div>
  );
}