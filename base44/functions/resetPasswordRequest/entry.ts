import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from './_shared/cors.ts';

const corsHeaders = getCorsHeaders({ methods: 'POST, OPTIONS' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return Response.json({ success: false, error: 'Ungültige Email' }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const driverAppDomain = Deno.env.get("DRIVER_APP_DOMAIN") || 'https://desponexodriver.app';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // 🔐 Rate Limiting via Supabase (instanzübergreifend!)
    const emailNorm = email.toLowerCase().trim();
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: recentAttempts, error: rateLimitError } = await supabase
      .from('rate_limit_attempts')
      .select('id', { count: 'exact' })
      .eq('email_normalized', emailNorm)
      .eq('client_ip', clientIP)
      .gt('attempt_at', fifteenMinutesAgo);

    if (recentAttempts && recentAttempts.length >= 5) {
      console.warn(`⚠️ Rate limit exceeded for email: ${emailNorm}, IP: ${clientIP}`);
      return Response.json({ 
        success: true,  // Immer true - kein User Enumeration!
        message: 'Wenn die Email existiert, wurde eine Nachricht versendet' 
      }, { status: 200, headers: corsHeaders });
    }

    // 1. Prüfe ob Fahrer in drivers existiert und user_id hat (migriert)
    const { data: drivers, error: driverError } = await supabase
      .from('drivers')
      .select('id, user_id, email, first_name, last_name')
      .eq('email', email.toLowerCase())
      .limit(1);

    if (driverError || !drivers || drivers.length === 0) {
      // 🔐 KEIN USER ENUMERATION: Antworte immer positiv, auch wenn Email nicht existiert
      console.log(`⚠️ Password reset requested for non-existent email: ${email}`);
      return Response.json({ 
        success: true, 
        message: 'Wenn die Email existiert, wurde eine Nachricht versendet' 
      }, { status: 200, headers: corsHeaders });
    }

    const driver = drivers[0];

    if (!driver.user_id) {
      // Fahrer noch nicht migriert
      return Response.json({ 
        success: false, 
        error: 'Bitte kontaktiere deinen Administrator für die Erstanmeldung' 
      }, { status: 400, headers: corsHeaders });
    }

    // 2. Generiere Supabase Recovery Token (Scanner-sicher via hashed_token)
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: driver.email
    });

    if (resetError || !resetData?.properties?.hashed_token) {
      throw new Error('Recovery-Token konnte nicht generiert werden');
    }

    const hashedToken = resetData.properties.hashed_token;
    
    // Scanner-sicherer Link: Token wird erst im Browser verifiziert
    const resetLink = `${driverAppDomain}/AuthCallback?type=recovery&token_hash=${hashedToken}`;
    
    console.log('🔗 Generated scanner-safe reset link with hashed_token');

    // 3. Sende Email mit Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': Deno.env.get('BREVO_API_KEY')
      },
      body: JSON.stringify({
        to: [{ email: driver.email, name: `${driver.first_name} ${driver.last_name}` }],
        sender: { name: 'DespoNexo Driver', email: 'no-reply@desponexo.app' },
        subject: 'Passwort zurücksetzen',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #059669; margin: 0;">Passwort zurücksetzen</h2>
            </div>
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hallo ${driver.first_name},</p>
            <p style="font-size: 14px; color: #555; margin-bottom: 30px;">du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Klicke auf den Button unten um dein Passwort zu ändern.</p>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${resetLink}" style="background-color: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                Passwort zurücksetzen
              </a>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
              Dieser Link ist zeitlich begrenzt gültig.<br>
              Wenn du diese Anfrage nicht gestellt hast, ignoriere diese Email und dein Passwort bleibt unverändert.
            </p>
          </div>
        `
      })
    });

    if (!brevoResponse.ok) {
      const brevoError = await brevoResponse.text();
      console.error('Brevo Error:', brevoError);
      throw new Error('Email konnte nicht versendet werden');
    }

    console.log(`✅ Password reset email sent to ${driver.email}`);

    // 📊 Log attempt asynchronously (fire & forget, blockt nicht)
    (async () => {
      try {
        await supabase
          .from('rate_limit_attempts')
          .insert({ email_normalized: emailNorm, client_ip: clientIP });
      } catch (e) {
        console.warn('Rate limit logging failed:', e.message);
      }
    })();

    return Response.json({ 
      success: true, 
      message: 'Email wurde versendet' 
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('❌ Error in resetPasswordRequest:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500, headers: corsHeaders });
  }
});