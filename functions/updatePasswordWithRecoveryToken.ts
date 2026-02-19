import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { access_token, refresh_token, new_password } = await req.json();

    if (!access_token || !refresh_token || !new_password) {
      return Response.json({ 
        success: false, 
        error: 'Fehlende Parameter' 
      }, { status: 400, headers: corsHeaders });
    }

    if (new_password.length < 6) {
      return Response.json({ 
        success: false, 
        error: 'Passwort muss mindestens 6 Zeichen lang sein' 
      }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Erstelle Admin Client mit Service Key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { 
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });

    // Validiere Recovery Token via Supabase (nicht JWT decode!)
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { 
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });

    // Validiere Token durch setSession (Supabase validiert intern)
    const { data: sessionData, error: sessionError } = await userSupabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (sessionError || !sessionData?.session?.user) {
      console.error('❌ Token validation failed:', sessionError?.message);
      return Response.json({ 
        success: false, 
        error: 'Ungültiger oder abgelaufener Link' 
      }, { status: 401, headers: corsHeaders });
    }

    const user = sessionData.session.user;
    console.log('✅ Token validiert für User:', user.email);

    // Aktualisiere Passwort als Admin
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: new_password }
    );

    if (updateError) {
      console.error('❌ Password update failed:', updateError);
      throw new Error('Passwort konnte nicht geändert werden');
    }

    console.log('✅ Passwort erfolgreich geändert für:', user.email);

    return Response.json({ 
      success: true, 
      message: 'Passwort erfolgreich geändert' 
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500, headers: corsHeaders });
  }
});