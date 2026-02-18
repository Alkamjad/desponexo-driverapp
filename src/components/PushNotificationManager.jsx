import { useEffect } from "react";
import { toast } from "sonner";

// Push-Benachrichtigungen Manager
export default function PushNotificationManager({ driverId }) {
  useEffect(() => {
    if (!driverId) return;

    // Prüfe Browser-Support
    if (!("Notification" in window)) {
      return;
    }

    // Lade Benachrichtigungspräferenzen
    const prefs = getNotificationPreferences();
    
    // Fordere Berechtigung an (nur wenn noch nicht entschieden)
    if (Notification.permission === "default" && prefs.enabled) {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          toast.success("Push-Benachrichtigungen aktiviert");
        }
      });
    }
  }, [driverId]);

  return null;
}

// Hilfsfunktionen für Benachrichtigungspräferenzen
export function getNotificationPreferences() {
  const defaults = {
    enabled: true,
    newTour: true,
    tourChange: true,
    tourCancelled: true,
    payment: true,
    criticalWarning: true,
    message: true
  };

  try {
    const saved = localStorage.getItem("notification_preferences");
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveNotificationPreferences(prefs) {
  localStorage.setItem("notification_preferences", JSON.stringify(prefs));
}

// Push-Benachrichtigung senden
export function sendPushNotification(type, data) {
  // Prüfe ob Notification API verfügbar ist (nicht in Android WebView)
  if (!window.Notification) {
    return;
  }

  const prefs = getNotificationPreferences();
  
  // Prüfe ob Benachrichtigungen aktiviert sind
  if (!prefs.enabled || !prefs[type]) {
    return;
  }

  // Prüfe Browser-Berechtigung
  if (Notification.permission !== "granted") {
    return;
  }

  const notifications = {
    newTour: {
      title: "🚚 Neue Tour zugewiesen",
      body: data.tourTitle || "Du hast eine neue Tour erhalten",
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2310b981' width='100' height='100'/%3E%3C/svg%3E"
    },
    tourChange: {
      title: "📝 Tour aktualisiert",
      body: data.message || "Eine deiner Touren wurde geändert",
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2310b981' width='100' height='100'/%3E%3C/svg%3E"
    },
    tourCancelled: {
      title: "❌ Tour storniert",
      body: data.tourTitle || "Eine Tour wurde storniert",
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2310b981' width='100' height='100'/%3E%3C/svg%3E"
    },
    payment: {
      title: "💰 Neue Abrechnung",
      body: data.amount ? `${data.amount}€ wurden gutgeschrieben` : "Neue Zahlung erhalten",
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2310b981' width='100' height='100'/%3E%3C/svg%3E"
    },
    criticalWarning: {
      title: "⚠️ Wichtige Warnung",
      body: data.message || "Bitte App öffnen",
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2310b981' width='100' height='100'/%3E%3C/svg%3E",
      requireInteraction: true
    },
    message: {
      title: "💬 Neue Nachricht",
      body: data.message || "Du hast eine neue Nachricht",
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2310b981' width='100' height='100'/%3E%3C/svg%3E"
    }
  };

  const config = notifications[type];
  if (!config) return;

  try {
    const notification = new Notification(config.title, {
      body: config.body,
      icon: config.icon,
      badge: config.icon,
      requireInteraction: config.requireInteraction || false,
      tag: data.tag || type,
      vibrate: [200, 100, 200]
    });

    // Navigation bei Klick
    notification.onclick = () => {
      window.focus();
      if (data.url) {
        window.location.href = data.url;
      }
      notification.close();
    };
  } catch (error) {}
}