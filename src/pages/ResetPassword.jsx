import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import supabaseClient from "@/components/supabaseClient";

export default function ResetPassword() {
  console.log('🚀 RESET PASSWORD COMPONENT LOADED');
  
  const navigate = useNavigate();
  const [step, setStep] = useState('loading'); // 'loading', 'request', 'confirm', 'success'
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Prüfe Supabase Session beim Laden
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        console.log('🔍 RESET PASSWORD - Session Check:', { 
          hasSession: !!session,
          sessionType: session?.user?.aud
        });

        if (session) {
          // Session vorhanden = aus Auth Callback hierher gekommen
          console.log('✅ Session gefunden - Zeige Passwort-Formular');
          setStep('confirm');
        } else {
          // Keine Session = normaler Zugriff
          console.log('ℹ️ Keine Session - Zeige Email-Formular');
          setStep('request');
        }
      } catch (err) {
        console.error('❌ Session Check Error:', err);
        setStep('request');
      }
    };

    checkSession();
  }, []);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error("Bitte eine gültige Email eingeben");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('https://desponexodriver.app/functions/resetPasswordRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Email wurde versendet!");
        toast.info("Bitte überprüfe dein Email-Postfach");
        setStep('success');
      } else {
        setError(result.error || 'Fehler beim Senden der Email');
        toast.error(result.error || 'Fehler beim Senden der Email');
      }
    } catch (err) {
      setError(err.message);
      toast.error("Verbindungsfehler");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    
    if (!newPassword || newPassword.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Supabase Auth - Passwort ändern
      const { error: updateError } = await supabaseClient.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      console.log('✅ Passwort erfolgreich geändert');
      
      // Session beenden
      await supabaseClient.auth.signOut();
      
      toast.success("Passwort erfolgreich geändert!");
      setStep('success');
      
      // Nach 2 Sekunden zur Anmeldung
      setTimeout(() => {
        navigate(createPageUrl('Anmelden'), { replace: true });
      }, 2000);

    } catch (err) {
      console.error('❌ Password Update Error:', err);
      setError(err.message);
      toast.error("Fehler beim Ändern des Passworts");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading während Session-Check
  if (step === 'loading') {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden" style={{ maxWidth: '100vw' }}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="animate-in zoom-in-95 fade-in duration-700">
          <Card className="border-0 shadow-2xl bg-slate-900/80 backdrop-blur-xl">
            <CardHeader className="text-center pb-6 pt-8">
              <CardTitle className="text-3xl text-white font-bold mb-2">
                Passwort zurücksetzen
              </CardTitle>
              <CardDescription className="text-slate-300">
                {step === 'request' && 'Gib deine Email ein, um einen Reset-Link zu erhalten'}
                {step === 'confirm' && 'Setze dein neues Passwort'}
                {step === 'success' && 'Email wurde versendet'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 px-6 pb-8">
              {error && (
                <Alert className="bg-red-950/50 border-red-500/50">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-200">{error}</AlertDescription>
                </Alert>
              )}

              {/* Step 1: Request Reset */}
              {step === 'request' && (
                <form onSubmit={handleRequestReset} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-200 font-medium">
                      Email
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 z-10" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-emerald-500 h-14 rounded-xl"
                        placeholder="fahrer@beispiel.de"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white h-14 font-bold rounded-xl"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Sende Email...
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5 mr-2" />
                        Reset-Link senden
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* Step 2: Confirm Reset */}
              {step === 'confirm' && (
                <form onSubmit={handleConfirmReset} className="space-y-5">
                  <Alert className="bg-emerald-950/50 border-emerald-500/50 mb-4">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <AlertDescription className="text-emerald-200">
                      Link erfolgreich verifiziert! Setze jetzt dein neues Passwort.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-slate-200 font-medium">
                      Neues Passwort
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 z-10" />
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-12 pr-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-emerald-500 h-14 rounded-xl"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 z-10"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-200 font-medium">
                      Passwort wiederholen
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 z-10" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-12 pr-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-emerald-500 h-14 rounded-xl"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 z-10"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white h-14 font-bold rounded-xl"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Speichert...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5 mr-2" />
                        Passwort ändern
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* Step 3: Success */}
              {step === 'success' && (
                <div className="text-center space-y-4 py-6">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
                      <CheckCircle2 className="relative w-16 h-16 text-emerald-400 animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-200 font-medium">Email wurde versendet!</p>
                    <p className="text-slate-400 text-sm">
                      Überprüfe dein Postfach und klicke auf den Link um dein Passwort zurückzusetzen.
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate(createPageUrl('Anmelden'))}
                    variant="outline"
                    className="w-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 h-12 rounded-xl"
                  >
                    Zurück zur Anmeldung
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2 text-xs">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl('Anmelden'))}
            className="text-slate-400 hover:text-emerald-400 w-full"
          >
            ← Zurück zur Anmeldung
          </Button>
        </div>
      </div>
    </div>
  );
}