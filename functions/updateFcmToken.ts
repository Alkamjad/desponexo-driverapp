import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

async function verifyRequest(req) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ NO BEARER TOKEN');
      return { valid: false, status: 401 };
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error('❌ ENV CONFIG MISSING');
      return { valid: false, status: 500 };
    }
    
    // Validiere Token via Supabase Auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const tokenOnly = token.trim();
    
    const { data: { user }, error } = await supabase.auth.getUser(tokenOnly);
    
    if (error || !user) {
      console.error('❌ AUTH ERROR');
      return { valid: false, status: 401 };
    }
    
    console.log('✅ USER AUTHENTICATED:', user.id);
    
    // Hole driver_id mit SERVICE KEY
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id, company_id')
      .eq('user_id', user.id)
      .single();
    
    if (driverError || !driver) {
      console.error('❌ DRIVER NOT FOUND');
      return { valid: false, status: 403 };
    }
    
    console.log('✅ DRIVER FOUND:', driver.id);
    return { valid: true, driver, user_id: user.id };
  } catch (error) {
    console.error('❌ VERIFY REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401 };
  }
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://desponexodriver.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Auth prüfen
    const auth = await verifyRequest(req);
    if (!auth.valid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: auth.status, headers: corsHeaders }
      );
    }

    const driver = auth.driver;
    const { fcm_token, fcm_platform } = await req.json();

    if (!fcm_token || typeof fcm_token !== 'string' || fcm_token.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'FCM Token erforderlich' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ✅ FCM Token Format Validierung (Firebase Format)
    // Firebase FCM tokens sind ~150-200 Zeichen, alphanumeric + einige spezielle Zeichen
    const fcmTokenRegex = /^[a-zA-Z0-9_-]{100,}$/;
    if (!fcmTokenRegex.test(fcm_token)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ungültiges FCM Token Format' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ✅ Platform Validierung
    const validPlatforms = ['ios', 'android', 'web'];
    const platform = (fcm_platform || 'unknown').toLowerCase();
    if (!validPlatforms.includes(platform) && platform !== 'unknown') {
      return new Response(
        JSON.stringify({ success: false, error: 'Ungültige Platform' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('📱 Updating FCM token for driver:', driver.id);

    // Update mit Service Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseService = createClient(supabaseUrl, serviceKey);

    const { error: updateError } = await supabaseService
      .from('drivers')
      .update({
        fcm_token: fcm_token.trim(),
        fcm_platform: platform,
        fcm_registered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', driver.id);

    if (updateError) {
      console.error('❌ Update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('✅ FCM token updated');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('💥 updateFcmToken error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});