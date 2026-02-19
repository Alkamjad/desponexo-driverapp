import supabase from '@/components/supabaseClient';

export const authService = {
  async loginDriver(email, password, invitation_token = null) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password
      });

      if (error) {
        console.error('Supabase Auth Error:', error);

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
        await supabase.auth.signOut();
        return {
          success: false,
          status: 'no_driver_profile',
          error: 'Kein Fahrer-Profil gefunden'
        };
      }

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
  }
};

export default authService;
