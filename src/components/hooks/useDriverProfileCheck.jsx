import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import supabaseClient from '@/components/supabaseClient';
import { toast } from 'sonner';

export default function useDriverProfileCheck() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAndSubscribe = async () => {
      try {
        // Hole Fahrer-ID aus localStorage
        const driverId = localStorage.getItem('driver_id');
        const driverEmail = localStorage.getItem('driver_email');

        if (!driverId || !driverEmail) return;

        // Prüfe ob Profil noch existiert
        const { data: driver, error } = await supabaseClient
          .from('drivers')
          .select('id')
          .eq('id', driverId)
          .single();

        if (error || !driver) {
          // Profil existiert nicht mehr → Logout
          await logout();
          return;
        }

        // Subscribe zu Änderungen auf dem drivers Table (Realtime)
        const channel = supabaseClient
          .channel(`driver-profile-${driverId}`)
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'drivers',
              filter: `id=eq.${driverId}`
            },
            () => {
               logout();
             }
          )
          .subscribe();

        return () => {
          supabaseClient.removeChannel(channel);
        };
      } catch (err) {
      }
    };

    const logout = async () => {
      try {
        // Logout von Supabase
        await supabaseClient.auth.signOut();
        
        // Lösche lokale Daten
        localStorage.removeItem('driver_id');
        localStorage.removeItem('driver_email');
        localStorage.removeItem('driver_data');
        
        toast.error('Dein Profil wurde gelöscht. Bitte melde dich erneut an.');
        
        // Redirect zu Anmeldung
        navigate(createPageUrl('Anmelden'), { replace: true });
      } catch (err) {
      }
    };

    checkAndSubscribe();
  }, [navigate]);
}