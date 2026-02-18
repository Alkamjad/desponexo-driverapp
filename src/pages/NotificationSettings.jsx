import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, BellOff, Truck, DollarSign, MessageCircle, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import { getNotificationPreferences, saveNotificationPreferences } from "@/components/PushNotificationManager";
import { t } from "@/components/utils/i18n";

export default function NotificationSettings() {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(getNotificationPreferences());
  const [browserPermission, setBrowserPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const notificationTypes = [
    {
      id: "newTour",
      label: "Neue Tourzuweisungen",
      description: "Benachrichtigung bei neuen zugewiesenen Touren",
      icon: Truck,
      color: "text-blue-400"
    },
    {
      id: "tourChange",
      label: "Touränderungen",
      description: "Updates zu bestehenden Touren",
      icon: Bell,
      color: "text-purple-400"
    },
    {
      id: "tourCancelled",
      label: "Tourstornierungen",
      description: "Benachrichtigung bei stornierten Touren",
      icon: BellOff,
      color: "text-red-400"
    },
    {
      id: "payment",
      label: "Abrechnungen & Zahlungen",
      description: "Neue Zahlungen und Abrechnungen",
      icon: DollarSign,
      color: "text-green-400"
    },
    {
      id: "message",
      label: "Nachrichten",
      description: "Neue Chat-Nachrichten vom Disponenten",
      icon: MessageCircle,
      color: "text-emerald-400"
    },
    {
      id: "criticalWarning",
      label: "Kritische Warnungen",
      description: "Wichtige Warnungen (z.B. Fahrzeugprobleme)",
      icon: AlertTriangle,
      color: "text-orange-400"
    }
  ];

  const handleToggle = (id) => {
    setPreferences(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleMasterToggle = () => {
    setPreferences(prev => ({
      ...prev,
      enabled: !prev.enabled
    }));
  };

  const handleSave = async () => {
    saveNotificationPreferences(preferences);
    
    // Fordere Browser-Berechtigung an wenn aktiviert
    if (preferences.enabled && browserPermission === "default") {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      
      if (permission === "granted") {
        toast.success("Einstellungen gespeichert & Benachrichtigungen aktiviert");
      } else {
        toast.warning("Einstellungen gespeichert, aber Browser-Berechtigung fehlt");
      }
    } else {
      toast.success("Einstellungen gespeichert");
    }
  };

  const requestBrowserPermission = async () => {
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    
    if (permission === "granted") {
      toast.success("Browser-Benachrichtigungen aktiviert");
    } else {
      toast.error("Berechtigung wurde abgelehnt");
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 pt-8 pb-8">
        <div className="flex items-center gap-4 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Profil'))}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bell className="w-6 h-6" />
              Benachrichtigungen
            </h1>
            <p className="text-emerald-100 text-sm">Verwalte deine Benachrichtigungseinstellungen</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-4">
        {/* Browser-Berechtigung Status */}
        {browserPermission !== "granted" && (
          <Card className="border-0 shadow-lg bg-yellow-500/20 border border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-yellow-300 font-medium mb-1">Browser-Berechtigung erforderlich</p>
                  <p className="text-yellow-200/80 text-sm mb-3">
                    Erlaube Push-Benachrichtigungen in deinem Browser, um Benachrichtigungen zu erhalten.
                  </p>
                  <Button
                    onClick={requestBrowserPermission}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    size="sm"
                  >
                    Berechtigung erteilen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Master Toggle */}
        <Card className="border-0 shadow-lg bg-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  preferences.enabled ? 'bg-emerald-500/20' : 'bg-slate-700'
                }`}>
                  {preferences.enabled ? (
                    <Bell className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <BellOff className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-white font-medium">Alle Benachrichtigungen</p>
                  <p className="text-slate-400 text-sm">
                    {preferences.enabled ? "Aktiviert" : "Deaktiviert"}
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.enabled}
                onCheckedChange={handleMasterToggle}
              />
            </div>
          </CardContent>
        </Card>

        {/* Benachrichtigungstypen */}
        <Card className="border-0 shadow-lg bg-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg">Benachrichtigungsarten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notificationTypes.map((type) => {
              const Icon = type.icon;
              return (
                <div
                  key={type.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-slate-800 flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${type.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{type.label}</p>
                    <p className="text-slate-400 text-sm">{type.description}</p>
                  </div>
                  <Switch
                    checked={preferences.enabled && preferences[type.id]}
                    onCheckedChange={() => handleToggle(type.id)}
                    disabled={!preferences.enabled}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="border-0 shadow-lg bg-slate-800">
          <CardContent className="p-4">
            <p className="text-slate-400 text-sm">
              💡 <strong className="text-slate-300">Hinweis:</strong> Push-Benachrichtigungen funktionieren auch wenn die App geschlossen ist. Stelle sicher, dass dein Browser Benachrichtigungen erlaubt.
            </p>
          </CardContent>
        </Card>

        {/* Speichern Button */}
        <Button
          onClick={handleSave}
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
        >
          <Save className="w-5 h-5 mr-2" />
          Einstellungen speichern
        </Button>
      </div>
    </div>
  );
}