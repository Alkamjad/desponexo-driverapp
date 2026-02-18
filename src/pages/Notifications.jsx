import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Bell, CheckCheck, Package, Euro, AlertTriangle,
  MessageCircle, Info, Loader2, RefreshCw, FileText
} from "lucide-react";
import { useNotifications } from "@/components/NotificationHub";
import { t } from "@/components/utils/i18n";

export default function Notifications() {
  const navigate = useNavigate();
  
  const driverId = localStorage.getItem("driver_id");
  
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();

  useEffect(() => {
    // Sofort als gelesen markieren via Backend (Service Role, umgeht RLS)
    const markRead = async () => {
      try {
        const API_BASE_URL = 'https://desponexodriver.app';
        await fetch(`${API_BASE_URL}/functions/markNotificationsRead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driver_id: driverId })
        });
      } catch(err) {
        console.error('markNotificationsRead error:', err);
      }
      // Lokalen State aktualisieren (Badge auf 0)
      try { markAllAsRead(driverId); } catch(_) {}
    };

    if (driverId) {
      markRead();
    }
  }, [driverId]);

  const getNotificationIcon = (type) => {
    const icons = {
      tour: <Package className="w-5 h-5 text-blue-400" />,
      tour_cancelled: <AlertTriangle className="w-5 h-5 text-orange-400" />,
      tour_approved: <CheckCheck className="w-5 h-5 text-emerald-400" />,
      payment: <Euro className="w-5 h-5 text-green-400" />,
      fuel: <Euro className="w-5 h-5 text-emerald-400" />,
      chat: <MessageCircle className="w-5 h-5 text-purple-400" />,
      message: <MessageCircle className="w-5 h-5 text-purple-400" />,
      document: <FileText className="w-5 h-5 text-sky-400" />,
      violation: <AlertTriangle className="w-5 h-5 text-red-400" />,
      general: <Info className="w-5 h-5 text-slate-400" />,
      warning: <AlertTriangle className="w-5 h-5 text-orange-400" />
    };
    return icons[type] || <Bell className="w-5 h-5 text-slate-400" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 pt-8">
        <div className="flex items-center gap-4 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Dashboard'))}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Bell className="w-6 h-6 text-emerald-400" />
              {t('notif_title')}
            </h1>
            {false && (
              <p className="text-slate-400 text-sm">{unreadCount} {t('notif_unread')}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={isLoading}
            className="text-white hover:bg-white/10"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>


      </div>

      <div className="px-4 py-4 space-y-3">
        {notifications.length === 0 ? (
          <Card className="border-0 shadow-lg bg-slate-800">
            <CardContent className="p-8 text-center">
              <Bell className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">{t('notif_no_notifications')}</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`border-0 shadow-lg transition-colors cursor-pointer ${
                notification.read ? 'bg-slate-800/50' : 'bg-slate-800 border-l-4 border-l-emerald-500'
              }`}
              onClick={() => !notification.read && markAsRead(notification.id)}
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-semibold ${notification.read ? 'text-slate-400' : 'text-white'}`}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <Badge className="bg-emerald-500/20 text-emerald-300 flex-shrink-0">
                          {t('notif_new')}
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${notification.read ? 'text-slate-500' : 'text-slate-300'}`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(notification.created_at).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}