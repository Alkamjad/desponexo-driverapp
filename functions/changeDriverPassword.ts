import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from './_shared/cors.ts';

async function requireUser(req) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, status: 401 };
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      return { valid: false, status: 500 };
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { valid: false, status: 401 };
    }
    
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (driverError || !driver) {
      return { valid: false, status: 403 };
    }
    
    return { valid: true, driver_id: driver.id, user_id: user.id };
  } catch (error) {
    console.error('❌ VERIFY REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401 };
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders({ methods: 'POST, OPTIONS' });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 🔐 Authenticate user via token
    const auth = await requireUser(req);
    if (!auth.valid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: auth.status, headers: corsHeaders }
      );
    }

    console.log('🔐 changeDriverPassword - Authenticated user:', auth.user_id);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    const body = await req.json();
    const { current_password, new_password } = body;
    
    // 🔴 SECURITY: Use driver_id from token, NOT from body
    const driver_id = auth.driver_id;

    if (!current_password || !new_password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Fehlende Parameter' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Neues Passwort muss mindestens 6 Zeichen lang sein' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Hole Email des Fahrers
    console.log('Fetching driver email...');
    const driverResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/drivers?id=eq.${driver_id}&select=email,user_id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!driverResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Fahrer nicht gefunden' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const drivers = await driverResponse.json();
    const driver = drivers[0];

    if (!driver || !driver.user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Fahrer hat keinen Auth-Account' }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log('Driver found:', driver.email);

    // 2. Validiere aktuelles Passwort durch Login-Versuch
    console.log('Validating current password...');
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: signInData, error: signInError } = await userSupabase.auth.signInWithPassword({
      email: driver.email,
      password: current_password
    });

    if (signInError || !signInData.user) {
      console.error('Current password validation failed');
      return new Response(
        JSON.stringify({ success: false, error: 'Aktuelles Passwort ist falsch' }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('✅ Current password validated');

    // 3. Update Passwort mit Admin API
    console.log('Updating password...');
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
      driver.user_id,
      { password: new_password }
    );

    if (updateError) {
      console.error('Password update failed:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Passwortänderung fehlgeschlagen' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('✅ Password changed for driver:', driver_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Passwort erfolgreich geändert'
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('❌ changeDriverPassword error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});