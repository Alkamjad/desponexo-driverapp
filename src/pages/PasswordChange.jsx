import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PasswordChange() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [driver, setDriver] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Lade pending Driver-Daten
    const pendingDriver = localStorage.getItem("pending_driver");
    const pendingToken = localStorage.getItem("pending_token");
    
    if (!pendingDriver || !pendingToken) {
      toast.error("Keine Anmeldedaten gefunden");
      navigate(createPageUrl('Anmelden'));
      return;
    }

    try {
      setDriver(JSON.parse(pendingDriver));
      setToken(pendingToken);
    } catch {
      navigate(createPageUrl('Anmelden'));
    }
  }, [navigate]);

  const isPasswordValid = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.error("Passwort muss mindestens 8 Zeichen haben");
      return;
    }

    if (!passwordsMatch) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }

    setIsLoading(true);

    try {
      console.log("Passwort ändern für Driver:", driver.id);
      
      const invitationToken = localStorage.getItem("invitation_token");
      
      const response = await fetch('/functions/setupDriverAccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitation_token: invitationToken,
          new_password: newPassword
        })
      });
      
      const data = await response.json();
      console.log("Password change response:", data);

      if (data.success || data.status === 'password_changed' || data.status === 'activated') {
        // Lösche pending Daten
        localStorage.removeItem("pending_driver");
        localStorage.removeItem("pending_token");
        
        // Speichere Login-Daten (driver_token wurde bereits von Supabase Auth gespeichert)
        localStorage.setItem("driver_id", driver.id);
        localStorage.setItem("driver_email", driver.email);
        localStorage.setItem("driver_data", JSON.stringify(driver));
        
        toast.success("Passwort erfolgreich geändert!");
        navigate(createPageUrl('Dashboard'));
      } else {
        toast.error(data.message || data.error || "Fehler beim Ändern des Passworts");
      }
    } catch (error) {
      console.error("Password change error:", error);
      toast.error("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!driver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center p-4">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
      
      <Card className="w-full max-w-md bg-slate-800/90 backdrop-blur-lg border-slate-700 shadow-2xl relative z-10">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <Lock className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Neues Passwort</h1>
            <p className="text-slate-400 text-sm">
              Hallo {driver.first_name || driver.vorname}! Bitte setze dein persönliches Passwort.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-300">Neues Passwort</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mindestens 8 Zeichen"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 h-12"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {newPassword && (
                <div className={`flex items-center gap-2 text-sm ${isPasswordValid ? 'text-green-400' : 'text-red-400'}`}>
                  {isPasswordValid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {isPasswordValid ? 'Passwort ist stark genug' : 'Mindestens 8 Zeichen erforderlich'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Passwort bestätigen</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Passwort wiederholen"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 h-12"
                  disabled={isLoading}
                />
              </div>
              {confirmPassword && (
                <div className={`flex items-center gap-2 text-sm ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                  {passwordsMatch ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {passwordsMatch ? 'Passwörter stimmen überein' : 'Passwörter stimmen nicht überein'}
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !isPasswordValid || !passwordsMatch}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                "Passwort speichern"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}