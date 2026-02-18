import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import supabaseClient from "@/components/supabaseClient";
import LoadingScreen from "@/components/LoadingScreen";
import { AlertCircle } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔐 AUTH CALLBACK - START');
        
        // Prüfe ob token_hash in URL (Scanner-sicherer Recovery Flow)
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get('token_hash');
        const type = params.get('type');
        
        if (type === 'recovery' && tokenHash) {
          console.log('🔑 Recovery Token Hash gefunden - Verifiziere...');
          
          // Verifiziere Token im Browser (Scanner-sicher!)
          const { data, error } = await supabaseClient.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash
          });
          
          if (error) {
            console.error('❌ Token Verification failed:', error);
            setError('Ungültiger oder abgelaufener Link');
            setTimeout(() => navigate(createPageUrl('Anmelden'), { replace: true }), 3000);
            return;
          }
          
          console.log('✅ Token erfolgreich verifiziert - Session erstellt');
          console.log('🚀 Redirect zu ResetPassword');
          navigate(createPageUrl('ResetPassword'), { replace: true });
          return;
        }
        
        // Fallback: Prüfe normale Session (für andere Auth-Flows)
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        console.log('🔍 Session Check:', { 
          hasSession: !!session,
          hasUser: !!session?.user,
          type: session?.user?.aud
        });
        
        if (!session) {
          console.log('❌ Keine gültige Session gefunden');
          setError('Ungültiger Zurücksetzen-Link');
          setTimeout(() => navigate(createPageUrl('Anmelden'), { replace: true }), 3000);
          return;
        }
        
        console.log('✅ Session gefunden');
        
        // Direkt zu Dashboard navigieren (normaler Login)
        console.log('🚀 Redirect zu Dashboard');
        navigate(createPageUrl('Dashboard'), { replace: true });
        
      } catch (err) {
        console.error('❌ Auth Callback Error:', err);
        setError(`Fehler: ${err.message}`);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
          <h2 className="text-xl text-white font-bold">Fehler</h2>
          <p className="text-slate-300">{error}</p>
          <p className="text-slate-400 text-sm">Du wirst zur Anmeldung weitergeleitet...</p>
        </div>
      </div>
    );
  }

  return <LoadingScreen message="Verarbeite Authentifizierung..." />;
}