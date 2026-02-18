import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, User, Package, Euro, FileText, Calendar, MessageCircle } from "lucide-react";
import { t, initLanguage } from "@/components/utils/i18n";
import PushNotificationService from "@/components/native/PushNotificationService";
import DeepLinkHandler from "@/components/native/DeepLinkHandler";
import NotificationHub from "@/components/NotificationHub";
import InAppNotificationBanner from "@/components/InAppNotificationBanner";
import useDriverProfileCheck from "@/components/hooks/useDriverProfileCheck";
import ErrorBoundary from "@/components/ErrorBoundary";
import PageTransition from "@/components/PageTransition";
import { useBackStackNavigation } from "@/components/hooks/useBackStackNavigation";
import { AuthProvider, useAuth } from "@/components/AuthContext";

function LayoutContent({ children, currentPageName }) {
  const { driver } = useAuth();
  
  // Back-Stack Navigation für Hardware-Back-Button
  useBackStackNavigation(currentPageName);
  
  // Überwache ob Fahrer-Profil noch existiert
  useDriverProfileCheck();

  // Initialisiere Sprache und Dark Mode beim App-Start
  useEffect(() => {
    initLanguage();
    
    // Dark Mode basierend auf System-Einstellung
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyDarkMode = (isDark) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    
    // Initiale Anwendung
    applyDarkMode(darkModeQuery.matches);
    
    // Listener für System-Änderungen
    darkModeQuery.addEventListener('change', (e) => applyDarkMode(e.matches));
    
    return () => {
      darkModeQuery.removeEventListener('change', (e) => applyDarkMode(e.matches));
    };
  }, []);

  // Login-, Reset-, Auth-Callback und Chat-Seite brauchen nur Children ohne Navigation
  if (currentPageName === "Anmelden" || currentPageName === "ResetPassword" || currentPageName === "SetPassword" || currentPageName === "AuthCallback" || currentPageName === "Chat") {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden relative">
          <div 
            className="fixed inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: 'url(https://attlcrcpybgfkygcgwvz.supabase.co/storage/v1/object/public/driver-assets/logo-alt.png)',
              backgroundPosition: 'center center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '45%',
              opacity: 0.4,
              filter: 'grayscale(40%) brightness(0.7)'
            }}
          />
          <div className="relative z-10">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  const navItems = [
    { name: "Dashboard", label: t('nav_home'), icon: Home },
    { name: "Uebersicht", label: t('nav_overview'), icon: Calendar },
    { name: "DriverHome", label: t('nav_tours'), icon: Package },
    { name: "Abrechnung", label: t('nav_billing'), icon: Euro },
    { name: "Profil", label: t('nav_profile'), icon: User }
  ];

  return (
      <ErrorBoundary>
      <>
      {/* Native Services */}
      <PushNotificationService />
      <DeepLinkHandler />
      <NotificationHub />
      <InAppNotificationBanner />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-20 overflow-x-hidden relative">
      {/* Logo Wasserzeichen im Hintergrund */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'url(https://attlcrcpybgfkygcgwvz.supabase.co/storage/v1/object/public/driver-assets/logo-alt.png)',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '45%',
          opacity: 0.4,
          filter: 'grayscale(40%) brightness(0.7)'
        }}
      />
      
      <div className="relative z-10">
        <PageTransition>
          {children}
        </PageTransition>
      </div>

      {/* Navigation nur anzeigen wenn NICHT auf TourDetails */}
      {currentPageName !== "TourDetails" && (
        <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-lg border-t border-emerald-900/50 shadow-lg z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex justify-around items-center h-18 px-2 py-2 max-w-screen-xl mx-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPageName === item.name;

              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.name)}
                  className={`flex flex-col items-center justify-center flex-1 h-full px-2 py-2 rounded-xl transition-all ${
                    isActive 
                      ? "text-emerald-400 bg-emerald-500/20 shadow-sm scale-105" 
                      : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
                  }`}
                >
                  <Icon className={`${isActive ? 'w-6 h-6' : 'w-5 h-5'} transition-all`} />
                  <span className={`text-xs mt-1 font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {item.label}
                  </span>

                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
    </>
    </ErrorBoundary>
    );
}

export default function Layout({ children, currentPageName }) {
  return (
    <AuthProvider>
      <LayoutContent children={children} currentPageName={currentPageName} />
    </AuthProvider>
  );
}