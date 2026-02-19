import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from './_shared/cors.ts';

const corsHeaders = getCorsHeaders({ methods: 'POST, OPTIONS' });
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

// Rate Limiting Map (in-memory)
const rateLimitMap = new Map();

function checkRateLimit(key, maxAttempts = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const record = rateLimitMap.get(key) || { attempts: [] };
  
  record.attempts = record.attempts.filter(t => now - t < windowMs);
  
  if (record.attempts.length >= maxAttempts) {
    return false;
  }
  
  record.attempts.push(now);
  rateLimitMap.set(key, record);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log('🔐 setupDriverAccount - Supabase Auth Version');

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const body = await req.json();
    const { invitation_token, new_password, validate_only } = body;

    if (!invitation_token) {
      return Response.json(
        { success: false, error: 'Token erforderlich' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Rate Limiting - verhindert Token Brute Force
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIP + ':setup', 10, 15 * 60 * 1000)) {
      console.warn(`⚠️ Rate limit exceeded for setup: ${clientIP}`);
      return Response.json(
        { success: false, error: 'Zu viele Versuche. Bitte später erneut versuchen.' },
        { status: 429, headers: corsHeaders }
      );
    }

    if (!validate_only && new_password && new_password.length < 6) {
      return Response.json(
        { success: false, error: 'Passwort muss mindestens 6 Zeichen lang sein' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Fahrer mit Token suchen in drivers Tabelle (via Supabase SDK)
    console.log('🔍 Looking for driver with invitation token...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: drivers, error: queryError } = await supabase
      .from('drivers')
      .select('*')
      .eq('invitation_token', invitation_token)
      .limit(1);

    if (queryError || !drivers || drivers.length === 0) {
      console.warn(`⚠️ Invalid invitation token attempt`);
      return Response.json(
        { success: false, error: 'Ungültiger Token' },
        { status: 401, headers: corsHeaders }
      );
    }

    const driver = drivers[0];

    // Token-Ablauf prüfen
    if (driver.invitation_expires && new Date(driver.invitation_expires) < new Date()) {
      console.warn(`⚠️ Invitation token expired for driver: ${driver.id}`);
      return Response.json(
        { success: false, error: 'Einladungslink ist abgelaufen' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Bereits aktiviert?
    if (driver.first_login_required === false) {
      console.warn(`⚠️ Account already activated: ${driver.id}`);
      return Response.json(
        { success: false, error: 'Account wurde bereits aktiviert' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!driver.user_id) {
      console.error(`❌ No user_id for driver: ${driver.id}`);
      return Response.json(
        { success: false, error: 'Kein Supabase Auth User zugeordnet' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('✅ Driver found:', driver.email);

    // Nur validieren?
    if (validate_only) {
      console.log('✅ Token validation successful (validate_only)');
      return Response.json({ 
        success: true, 
        driver: {
          id: driver.id,
          email: driver.email,
          full_name: driver.full_name,
          first_name: driver.full_name?.split(' ')[0] || ''
        }
      }, { status: 200, headers: corsHeaders });
    }

    if (!new_password) {
      return Response.json(
        { success: false, error: 'Passwort erforderlich' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Setze Passwort für Supabase Auth User
    console.log('🔐 Setting password for user...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      driver.user_id,
      { password: new_password }
    );

    if (updateError) {
      console.error('❌ Password setup failed:', updateError);
      return Response.json(
        { success: false, error: 'Passwort-Setup fehlgeschlagen' },
        { status: 500, headers: corsHeaders }
      );
    }

    // 3. Update Driver in DB - Account aktivieren
    console.log('🚀 Activating driver account...');
    const { error: activateError } = await supabase
      .from('drivers')
      .update({
        first_login_required: false,
        driver_access: 'aktiv',
        invitation_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', driver.id);

    if (activateError) {
      console.error('❌ Account activation failed:', activateError);
      return Response.json(
        { success: false, error: 'Account-Aktivierung fehlgeschlagen' },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('✅ Account setup complete for driver:', driver.id);

    return Response.json({ 
      success: true, 
      message: 'Account erfolgreich eingerichtet'
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('❌ setupDriverAccount error:', error);
    return Response.json({ 
      success: false, 
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
});