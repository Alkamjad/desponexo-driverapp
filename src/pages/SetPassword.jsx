import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import supabaseClient from "@/components/supabaseClient";

export default function SetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Prüfe ob Recovery-Tokens vorhanden sind
  useEffect(() => {
    const checkAuth = () => {
      const tokenData = localStorage.getItem('sb-attlcrcpybgfkygcgwvz-auth-token');
      
      if (!tokenData) {
        console.log('❌ Keine Tokens - Redirect zu Anmelden');
        navigate(createPageUrl('Anmelden'), { replace: true });
      } else {
        console.log('✅ Tokens vorhanden - Zeige Passwort-Formular');
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('🚀 SUBMIT - Password Change gestartet');
    
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
      // Hole Tokens aus LocalStorage
      const tokenData = localStorage.getItem('sb-attlcrcpybgfkygcgwvz-auth-token');
      console.log('🔑 Token Data gefunden:', !!tokenData);
      
      if (!tokenData) {
        throw new Error('Keine Authentifizierung gefunden');
      }
      
      const tokens = JSON.parse(tokenData);
      console.log('🔓 Tokens parsed:', { hasAccess: !!tokens.access_token, hasRefresh: !!tokens.refresh_token });
      
      // Backend-Funktion aufrufen zum Passwort ändern
      console.log('⏳ Rufe Backend-Funktion auf...');
      const response = await fetch('https://desponexodriver.app/functions/updatePasswordWithRecoveryToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          new_password: newPassword
        })
      });

      const result = await response.json();
      console.log('📡 Backend Response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Passwort konnte nicht geändert werden');
      }

      console.log('✅ Passwort erfolgreich geändert');
      
      // Lösche Tokens
      localStorage.removeItem('sb-attlcrcpybgfkygcgwvz-auth-token');
      
      toast.success("Passwort erfolgreich geändert!");
      setSuccess(true);
      
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

  if (success) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-pulse" />
          </div>
          <h2 className="text-xl text-white font-bold">Passwort erfolgreich geändert!</h2>
          <p className="text-slate-300">Du wirst zur Anmeldung weitergeleitet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Card className="border-0 shadow-2xl bg-slate-900/80 backdrop-blur-xl">
          <CardHeader className="text-center pb-6 pt-8">
            <CardTitle className="text-3xl text-white font-bold mb-2">
              Neues Passwort setzen
            </CardTitle>
            <CardDescription className="text-slate-300">
              Wähle ein sicheres Passwort für dein Konto
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-8">
            {error && (
              <Alert className="bg-red-950/50 border-red-500/50">
                <AlertDescription className="text-red-200">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}