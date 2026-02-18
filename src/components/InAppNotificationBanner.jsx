import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Euro, MessageCircle, AlertTriangle, CheckCircle2, FileText, Bell, X, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const ICON_MAP = {
  tour: { icon: Package, gradient: "from-blue-500 to-blue-600", ring: "ring-blue-500/30" },
  tour_cancelled: { icon: AlertTriangle, gradient: "from-orange-500 to-amber-600", ring: "ring-orange-500/30" },
  tour_approved: { icon: CheckCircle2, gradient: "from-emerald-500 to-green-600", ring: "ring-emerald-500/30" },
  payment: { icon: Euro, gradient: "from-green-500 to-emerald-600", ring: "ring-green-500/30" },
  fuel: { icon: Euro, gradient: "from-teal-500 to-emerald-600", ring: "ring-teal-500/30" },
  fuel_approved: { icon: CheckCircle2, gradient: "from-emerald-500 to-green-600", ring: "ring-emerald-500/30" },
  chat: { icon: MessageCircle, gradient: "from-violet-500 to-purple-600", ring: "ring-violet-500/30" },
  message: { icon: MessageCircle, gradient: "from-violet-500 to-purple-600", ring: "ring-violet-500/30" },
  document: { icon: FileText, gradient: "from-sky-500 to-blue-600", ring: "ring-sky-500/30" },
  violation: { icon: AlertTriangle, gradient: "from-red-500 to-rose-600", ring: "ring-red-500/30" },
};

const DEFAULT_ICON = { icon: Bell, gradient: "from-slate-500 to-slate-600", ring: "ring-slate-500/30" };

export default function InAppNotificationBanner() {
  const [banners, setBanners] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      const notif = e.detail;
      if (!notif) return;
      const id = notif.id || Date.now() + Math.random();
      setBanners(prev => [...prev, { ...notif, _bannerId: id }]);

      setTimeout(() => {
        setBanners(prev => prev.filter(b => b._bannerId !== id));
      }, 5000);
    };

    window.addEventListener('in-app-notification', handler);
    return () => window.removeEventListener('in-app-notification', handler);
  }, []);

  const dismiss = useCallback((bannerId) => {
    setBanners(prev => prev.filter(b => b._bannerId !== bannerId));
  }, []);

  const handleTap = useCallback((bannerId) => {
    dismiss(bannerId);
    navigate(createPageUrl('Notifications'));
  }, [dismiss, navigate]);

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none flex flex-col items-center" style={{ paddingTop: 'env(safe-area-inset-top, 8px)' }}>
      <AnimatePresence mode="popLayout">
        {banners.map((notif, index) => {
          const iconCfg = ICON_MAP[notif.type] || DEFAULT_ICON;
          const Icon = iconCfg.icon;

          return (
            <motion.div
              key={notif._bannerId}
              layout
              initial={{ y: -80, opacity: 0, scale: 0.85 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -60, opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
              className="pointer-events-auto w-[calc(100%-24px)] max-w-md mt-2"
            >
              <div
                onClick={() => handleTap(notif._bannerId)}
                className={`relative overflow-hidden bg-black/80 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/50 ring-1 ${iconCfg.ring} cursor-pointer active:scale-[0.97] transition-transform duration-150`}
              >
                {/* Subtiler Gradient-Stripe oben */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${iconCfg.gradient}`} />
                
                {/* Subtiler Glow-Effekt */}
                <div className={`absolute -top-8 -left-8 w-24 h-24 bg-gradient-to-br ${iconCfg.gradient} opacity-10 rounded-full blur-2xl`} />
                
                <div className="relative flex items-center gap-3 p-3.5 pr-2">
                  {/* Icon mit Gradient */}
                  <div className={`w-11 h-11 bg-gradient-to-br ${iconCfg.gradient} rounded-[14px] flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-[13px] leading-tight truncate">
                      {notif.title}
                    </p>
                    <p className="text-white/50 text-xs leading-tight mt-0.5 truncate">
                      {notif.message}
                    </p>
                  </div>

                  {/* Arrow + Close */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <div className="w-6 h-6 flex items-center justify-center text-white/30">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss(notif._bannerId); }}
                      className="w-7 h-7 flex items-center justify-center text-white/25 hover:text-white/60 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress-Bar für Auto-Dismiss */}
                <motion.div
                  className={`h-[2px] bg-gradient-to-r ${iconCfg.gradient} opacity-40`}
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 5, ease: "linear" }}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}