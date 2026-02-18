import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Loader2, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DriverChat from "@/components/driver/DriverChat";
import supabase from "@/components/supabaseClient";
import { t } from "@/components/utils/i18n";

export default function ChatPage() {
  const navigate = useNavigate();
  const [driverData, setDriverData] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Lade Fahrer-Daten
    const savedDriver = localStorage.getItem("driver_data");
    if (savedDriver) {
      try {
         const driver = JSON.parse(savedDriver);
         setDriverData(driver);

         // Lade ungelesene Nachrichten
         loadUnreadCount(driver.company_id);
       } catch (e) {
         // Error parsing driver data
      }
    }
  }, []);

  const loadUnreadCount = async (companyId) => {
    try {
      // Lade ungelesene Nachrichten direkt von Supabase (RLS)
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, sender_type, is_read')
        .eq('company_id', companyId)
        .eq('sender_type', 'company')
        .eq('is_read', false);

      if (!error && messages) {
        setUnreadCount(messages.length);
      }
    } catch (error) {
      console.warn('Error loading unread count:', error);
    }
  };

  if (!driverData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full flex-col max-w-[430px] mx-auto border-x border-slate-800/50 shadow-2xl bg-slate-950">
      {/* Wasserzeichen Hintergrund */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'url(https://attlcrcpybgfkygcgwvz.supabase.co/storage/v1/object/public/driver-assets/logo-alt.png)',
          backgroundRepeat: 'repeat',
          backgroundSize: '120px',
          opacity: 0.03
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/50 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-7 h-7" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="size-10 rounded-full bg-slate-800 overflow-hidden ring-2 ring-emerald-500/20">
                <MessageCircle className="w-full h-full object-cover p-2 text-emerald-400" />
              </div>
              <div className="absolute bottom-0 right-0 size-3 bg-emerald-500 rounded-full border-2 border-slate-900"></div>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white tracking-tight">
                {driverData.company_name || 'Support Zentrale'}
              </h2>
              <p className="text-[11px] text-emerald-500 font-medium uppercase tracking-widest">
                Aktiv
              </p>
            </div>
          </div>
        </div>
        <div className="text-slate-500">
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <DriverChat
          driverEmail={driverData.email}
          companyId={driverData.company_id}
        />
      </div>
    </div>
  );
}