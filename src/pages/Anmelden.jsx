// Anmelden.js - VERBESSERTE VERSION MIT JWT VALIDIERUNG
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Mail, Lock, Loader2, Eye, EyeOff, AlertCircle, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/components/AuthContext";
import { t, initLanguage, getCurrentLanguage, setLanguage } from "@/components/utils/i18n";
import { Globe } from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";


export default function Anmelden() {
  const navigate = useNavigate();
  const { supabase, updateDriver } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [accessError, setAccessError] = useState(null);
  const [rateLimitTime, setRateLimitTime] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Rate Limit Countdown Timer
  useEffect(() => {
    if (!isRateLimited) return;

    const timer = setInterval(() => {
      setRateLimitTime(prev => {
        if (prev <= 1) {
          setIsRateLimited(false);
          setAccessError(null);
          setFailedAttempts(0);
          localStorage.removeItem('rate_limit_until');
          localStorage.removeItem('failed_attempts');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRateLimited]);

  // Prüfe ob bereits eingeloggt + Rate Limit
  useEffect(() => {
    initLanguage(); // Sprache ZUERST initialisieren

    // JETZT Rate Limit Check (nach initLanguage!)
    const rateLimitUntil = localStorage.getItem('rate_limit_until');
    const limitType = localStorage.getItem('rate_limit_type') || 'email_ip';

    if (rateLimitUntil) {
      const now = Date.now();
      const lockTime = parseInt(rateLimitUntil, 10);

      if (now < lockTime) {
        // Rate Limit ist noch aktiv
        const remainingMs = lockTime - now;
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        const limitLabels = {
          'email_ip': `${Math.ceil(remainingSeconds / 60)} Minuten (Email + IP)`,
          'email_global': `${Math.ceil(remainingSeconds / 60)} Minuten (Email-weit)`,
          'ip_global': `${Math.ceil(remainingSeconds / 60)} Minuten (IP-weit)`
        };

        setIsRateLimited(true);
        setRateLimitTime(remainingSeconds);
        setAccessError({
          title: t('login_rate_limited_title'),
          message: t('login_rate_limited_message').replace('{time}', limitLabels[limitType] || `${Math.ceil(remainingSeconds / 60)} Minuten`),
          icon: '🔒',
          color: 'red',
          isRateLimit: true
        });
      } else {
        // Rate Limit ist abgelaufen
        localStorage.removeItem('rate_limit_until');
        localStorage.removeItem('rate_limit_type');
      }
    }

    const checkAuth = async () => {
      // WICHTIG: Wenn wir zur ResetPassword weitergeleitet werden, nicht blockieren!
      const hashPart = window.location.hash.split('?')[1];
      const urlParams = new URLSearchParams(hashPart || window.location.search);
      const resetToken = urlParams.get('token');
      if (resetToken) {
        // Wir sind in der ResetPassword-Flow, nicht zur Anmelden-Seite umleiten
        setCheckingAuth(false);
        return;
      }

      // Prüfe ob bereits eingeloggt (Supabase Session)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate(createPageUrl('Dashboard'));
        return;
      }

      // Prüfe URL für Email-Parameter (von Setup-Seite)
      const searchParams = new URLSearchParams(window.location.search);
      const emailParam = searchParams.get('email');
      if (emailParam) {
        setEmail(emailParam);
      }

      setCheckingAuth(false);
    };

    checkAuth();
  }, [navigate]);



  const handleLogin = async (e) => {
    e.preventDefault();

    // Validierung
    if (!email || !email.includes('@')) {
      toast.error("Bitte eine gültige Email eingeben");
      return;
    }

    if (!password || password.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen haben");
      return;
    }

    setIsLoading(true);
    setAccessError(null);

    try {
      // 1. Supabase Auth Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password
      });

      if (error) {
        
        // Fehler Mapping
        if (error.message.includes('Invalid login credentials')) {
          const newAttempts = failedAttempts + 1;
          setFailedAttempts(newAttempts);
          localStorage.setItem('failed_attempts', newAttempts.toString());

          let warningMessage = '';
          if (newAttempts === 1) warningMessage = t('login_invalid_attempts_2');
          else if (newAttempts === 2) warningMessage = t('login_invalid_attempts_1');

          setAccessError({
            title: t('login_invalid_credentials'),
            message: warningMessage,
            icon: '❌',
            color: 'red',
            warning: warningMessage
          });

          toast.error(t('login_invalid_credentials'), {
            description: warningMessage,
            duration: 6000
          });
          return;
        }
        
        throw new Error(error.message);
      }

      // 2. Driver-Profil laden
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select(`
          id,
          user_id,
          email,
          first_name,
          last_name,
          phone,
          company_id,
          driver_access,
          earnings_access_enabled
        `)
        .eq('user_id', data.user.id)
        .single();

      if (driverError) {
        await supabase.auth.signOut();
        
        setAccessError({
          title: "Kein Fahrer-Profil",
          message: "Kein Fahrer-Profil gefunden. Kontaktiere deinen Administrator.",
          icon: '⚠️',
          color: 'red'
        });
        toast.error("Kein Fahrer-Profil gefunden");
        return;
      }

      // 3. Access Status prüfen
      const driverAccess = driverData.driver_access || 'kein_zugang';
      if (driverAccess !== 'aktiv') {
        await supabase.auth.signOut();
        
        const statusInfo = {
          'kein_zugang': {
            title: t('login_access_denied'),
            message: t('login_access_denied_message'),
            icon: '🔒',
            color: 'yellow'
          },
          'pausiert': {
            title: t('login_access_paused'),
            message: t('login_access_paused_message'),
            icon: '⏸️',
            color: 'orange'
          },
          'gesperrt': {
            title: t('login_access_blocked'),
            message: t('login_access_blocked_message'),
            icon: '🚫',
            color: 'red'
          }
        }[driverAccess] || {
          title: t('error'),
          message: t('login_access_denied'),
          icon: '⚠️',
          color: 'red'
        };

        setAccessError(statusInfo);
        toast.error(statusInfo.title, {
          description: statusInfo.message,
          duration: 8000
        });
        return;
      }

      // 4. Erfolgreicher Login - Update AuthContext
      updateDriver(driverData);

      const firstName = driverData.first_name || "";
      toast.success(`Willkommen, ${firstName}!`);

      navigate(createPageUrl('Dashboard'));

    } catch (error) {
      setAccessError({
        title: "Verbindungsfehler",
        message: error.message || "Bitte überprüfe deine Internetverbindung und versuche es erneut.",
        icon: '⚠️',
        color: 'red'
      });
      toast.error("Verbindungsfehler", {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };



  // Ladeanzeige
  if (checkingAuth) {
    return <LoadingScreen message="Prüfe Anmeldung..." />;
  }

  const currentLang = getCurrentLanguage();

  const loginError = accessError?.color ? (
    accessError.title.includes('Passwort oder Email') ? 'invalid_credentials' :
    accessError.color === 'red' && accessError.title.includes('gesperrt') ? 'gesperrt' :
    accessError.color === 'orange' ? 'pausiert' : 'kein_zugang'
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-3xl" />
      </div>

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(16 185 129 / 0.15) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Rate Limit Banner */}
         {isRateLimited && accessError?.isRateLimit && (
            <div className="mb-6 animate-in slide-in-from-top-4 fade-in duration-500">
              <Alert className="bg-red-950/50 border-red-500/50 backdrop-blur-xl shadow-2xl">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <AlertTitle className="font-bold text-red-300 text-base">
                  🔒 {t('login_rate_limited_title')}
                </AlertTitle>
                <AlertDescription className="text-red-200/80 mt-2 text-sm">
                  {t('login_rate_limited_message').split('{time}')[0]}<span className="font-bold text-red-300">
                    {Math.floor(rateLimitTime / 60)}:{String(rateLimitTime % 60).padStart(2, '0')}
                  </span>
                </AlertDescription>
              </Alert>
            </div>
          )}

         {/* Access Denied Banner */}
         {loginError && !isRateLimited && accessError && (
           <div className="mb-6 animate-in slide-in-from-top-4 fade-in duration-500">
             <Alert className={`backdrop-blur-xl shadow-2xl ${
               accessError.warning ? 'bg-orange-950/50 border-orange-500/50' : 'bg-red-950/50 border-red-500/50'
             }`}>
               <AlertCircle className={`h-5 w-5 ${
                 accessError.warning ? 'text-orange-400' : 'text-red-400'
               }`} />
               <AlertTitle className={`font-bold text-base ${
                  accessError.warning ? 'text-orange-300' : 'text-red-300'
                }`}>
                  {loginError === 'invalid_credentials' && t('login_invalid_credentials')}
                  {loginError === 'kein_zugang' && t('login_access_denied')}
                  {loginError === 'pausiert' && t('login_access_paused')}
                  {loginError === 'gesperrt' && t('login_access_blocked')}
                </AlertTitle>
                <AlertDescription className={`mt-2 text-sm ${
                  accessError.warning ? 'text-orange-200/80' : 'text-red-200/80'
                }`}>
                  {loginError === 'invalid_credentials' && accessError.warning && (
                    <div className="font-semibold">
                      {accessError.warning}
                    </div>
                  )}
                  {loginError === 'kein_zugang' && t('login_access_denied_message')}
                  {loginError === 'pausiert' && t('login_access_paused_message')}
                  {loginError === 'gesperrt' && t('login_access_blocked_message')}
                </AlertDescription>
             </Alert>
           </div>
         )}

        {/* Login Card */}
        <div className="animate-in zoom-in-95 fade-in duration-700">
          <Card className="border-0 shadow-2xl bg-slate-900/80 backdrop-blur-xl relative overflow-hidden">
            {/* Card Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 pointer-events-none" />
            
            <CardHeader className="text-center pb-6 pt-8 relative">
              {/* Logo with Animation */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/10 blur-3xl animate-pulse" />
                  <img 
                    src="https://attlcrcpybgfkygcgwvz.supabase.co/storage/v1/object/public/driver-assets/logo-alt.png"
                    alt="N Driver App"
                    className="relative w-72 h-auto object-contain drop-shadow-2xl"
                  />
                </div>
              </div>
              
              <CardTitle className="text-3xl text-white font-bold mb-2 bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent">
                {t('login_title')}
              </CardTitle>
              <CardDescription className="text-slate-300 text-base">
                {t('login_subtitle')}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 px-6 pb-8">
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200 font-medium text-sm">
                    {t('login_email')}
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 group-focus-within:text-emerald-300 transition-colors z-10" />
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isRateLimited}
                        className="pl-12 pr-4 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 h-14 text-base rounded-xl transition-all backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="fahrer@beispiel.de"
                        required
                      />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200 font-medium text-sm">
                    {t('login_password')}
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 group-focus-within:text-emerald-300 transition-colors z-10" />
                    <Input
                       id="password"
                       type={showPassword ? "text" : "password"}
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       disabled={isRateLimited}
                       className="pl-12 pr-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 h-14 text-base rounded-xl transition-all backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                       placeholder="••••••••"
                       required
                     />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 transition-colors z-10"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white h-14 text-base font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || isRateLimited}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t('login_loading')}
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5 mr-2" />
                      {t('login_button')}
                    </>
                  )}
                </Button>

                {/* Forgot Password Link */}
                 <div className="text-center">
                   <Link 
                     to={createPageUrl('ResetPassword')}
                     className="text-slate-400 hover:text-emerald-400 text-sm transition-colors font-medium"
                   >
                     {t('login_forgot_password')}
                   </Link>
                 </div>
              </form>

              {/* Language Switcher */}
              <div className="pt-6 border-t border-slate-800/50">
                <LanguageSwitcher compact large />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer mit Rechtlichen Links */}
        <div className="text-center mt-6 space-y-2 animate-in fade-in duration-1000 delay-300">
          <div className="flex items-center justify-center gap-4 text-xs">
            <Link 
              to={createPageUrl('Impressum')} 
              className="text-slate-400 hover:text-emerald-400 transition-colors underline"
            >
              Impressum
            </Link>
            <span className="text-slate-700">•</span>
            <Link 
              to={createPageUrl('Datenschutz')} 
              className="text-slate-400 hover:text-emerald-400 transition-colors underline"
            >
              Datenschutz
            </Link>
          </div>
          <p className="text-slate-500 text-xs">
            © 2025 DespoNexo Driver · Powered by DespoNexo
          </p>
        </div>
      </div>
    </div>
  );
}