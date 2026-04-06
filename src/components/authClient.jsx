// authClient.js - DIREKTE SUPABASE REST API (ohne 44 SDK)
import { offlineManager } from './OfflineManager';
import supabase from './supabaseClient';
import { callFunction } from './utils/callFunction';

export const authClient = {
  
  // Login über Supabase Auth (kein Custom JWT mehr!)
  async loginDriver(email, password, invitation_token = null) {
    try {
      // Supabase Auth Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password
      });

      if (error) {
        console.error('Supabase Auth Error:', error);
        
        // Error Mapping
        if (error.message.includes('Invalid login credentials')) {
          return {
            success: false,
            status: 'invalid_credentials',
            error: 'Ungültige Email oder Passwort'
          };
        }
        
        return {
          success: false,
          status: 'error',
          error: error.message
        };
      }

      // Driver-Profil via RLS laden
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
        console.error('Driver Profile Error:', driverError);
        // User hat keinen Driver-Eintrag
        await supabase.auth.signOut();
        return {
          success: false,
          status: 'no_driver_profile',
          error: 'Kein Fahrer-Profil gefunden'
        };
      }

      // Access Status prüfen
      const driverAccess = driverData.driver_access || 'kein_zugang';
      if (driverAccess !== 'aktiv') {
        await supabase.auth.signOut();
        return {
          success: false,
          status: 'access_denied',
          access_status: driverAccess,
          error: 'Zugriff verweigert'
        };
      }

      // Erfolgreicher Login
      return {
        success: true,
        status: 'logged_in',
        session: data.session,
        driver: driverData
      };

    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  },



  // Tour Status aktualisieren - DIREKT an Supabase + Backend Function
  async updateTourStatus(tourId, status, additionalData = {}) {
    try {
      if (!tourId) return { error: 'No tourId' };

      const now = new Date().toISOString();
      const driverId = localStorage.getItem('driver_id');

      if (!navigator.onLine) {

        await offlineManager.updateTour(tourId, {
          status,
          updated_at: now,
          ...additionalData
        });

        await offlineManager.queueStatusUpdate(tourId, status, additionalData);

        return { 
          success: true, 
          offline: true,
          tour: await offlineManager.getTours().then(tours => 
            tours.find(t => t.id === tourId)
          )
        };
      }

      // Update über Backend Function
      const result = await callFunction('updateTourStatus', {
        tour_id: tourId,
        status,
        ...additionalData
      });

      return { 
        success: true, 
        tour: result.tour
      };

    } catch (error) {
      return { error: error.message };
    }
    },





  // Multi-Stop Tour: Update einzelner Stop - DIREKT an Supabase
  async updateTourStops(tourId, updatedStops) {
    try {
      if (!tourId || !updatedStops) {
        return { success: false, error: 'Missing tourId or stops' };
      }

      // Update über Backend Function
      const result = await callFunction('updateTourStops', {
        tour_id: tourId,
        stops: updatedStops
      });

      if (!result?.success || !result?.tour) {
        console.error('❌ updateTourStops failed:', result);
        return { success: false, error: result?.error || 'Backend returned no tour' };
      }

      return { 
        success: true, 
        tour: result.tour
      };

    } catch (error) {
      console.error('❌ updateTourStops exception:', error);
      return { success: false, error: error.message };
    }
    },









};

export default authClient;