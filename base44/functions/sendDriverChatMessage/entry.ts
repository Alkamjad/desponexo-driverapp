import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

async function verifyRequest(req) {
  try {
    const supabaseToken = req.headers.get('x-supabase-auth');
    const authHeader = req.headers.get('Authorization') || '';
    const token = supabaseToken || (authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null);
    if (!token) {
      console.error('❌ NO AUTH TOKEN');
      return { valid: false, status: 401 };
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error('❌ ENV CONFIG MISSING:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_ANON_KEY: !!supabaseAnonKey,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceKey
      });
      return { valid: false, status: 500 };
    }
    
    // Validiere Token via Supabase Auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const tokenOnly = token.trim();
    
    const { data: { user }, error } = await supabase.auth.getUser(tokenOnly);
    
    if (error) {
      console.error('❌ AUTH ERROR:', error.message);
      return { valid: false, status: 401 };
    }
    
    if (!user) {
      console.error('❌ NO USER FOUND');
      return { valid: false, status: 401 };
    }
    
    console.log('✅ USER AUTHENTICATED:', user.id);
    
    // Hole driver_id mit SERVICE KEY
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id, company_id, first_name, last_name, email')
      .eq('user_id', user.id)
      .single();
    
    if (driverError) {
      console.error('❌ DRIVER ERROR:', driverError.message);
      return { valid: false, status: 403 };
    }
    
    if (!driver) {
      console.error('❌ NO DRIVER FOUND FOR USER');
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-auth, x-client-request-id',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const auth = await verifyRequest(req);
    if (!auth.valid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: auth.status, headers: corsHeaders }
      );
    }

    const driver = auth.driver;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseService = createClient(supabaseUrl, serviceKey);

    let attachment_url = null;
    let audio_url = null;
    let message = '';

    // Check Content-Type: Multipart (mit Datei) oder JSON
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Multipart: File-Upload zu privatem Bucket + Signed URL
      const formData = await req.formData();
      message = formData.get('message') || '';
      const file = formData.get('file');
      const fileType = formData.get('type'); // 'image' oder 'audio'

      if (file) {
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'bin';
        const prefix = fileType === 'audio' ? 'voice' : 'photo';
        const fileName = `${driver.company_id}/${driver.id}/${prefix}_${timestamp}.${extension}`;

        console.log('📤 Uploading file:', fileName);

        // Upload zu privatem Bucket mit Service Key
        const { data: uploadData, error: uploadError } = await supabaseService.storage
          .from('chat_files')
          .upload(fileName, file, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) {
          console.error('❌ Upload error:', uploadError);
          return new Response(
            JSON.stringify({ success: false, error: uploadError.message }),
            { status: 500, headers: corsHeaders }
          );
        }

        // Speichere FILE PATH (nicht Signed URL) - Frontend lädt mit RLS
        if (fileType === 'audio') {
          audio_url = uploadData.path;
        } else {
          attachment_url = uploadData.path;
        }

        console.log('✅ File uploaded, path stored:', uploadData.path);
      }
    } else {
      // JSON: Nur Text (keine Dateien)
      const body = await req.json();
      message = body.message || '';
      attachment_url = body.attachment_url || null;
      audio_url = body.audio_url || null;
    }
    
    if (!message && !attachment_url && !audio_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nachricht, Datei oder Audio erforderlich' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const driverFullName = `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Fahrer';

    console.log('📤 Driver sending message:', { 
      driver_id: driver.id, 
      company_id: driver.company_id,
      message 
    });

    // Insert Chat Message
    const messageData = {
      company_id: driver.company_id,
      driver_id: driver.id,
      sender_type: 'driver',
      sender_name: driverFullName,
      message: message || '',
      attachment_url: attachment_url || null,
      audio_url: audio_url || null,
      driver_email: driver.email || null,
      driver_name: driverFullName,
      is_read: true
    };

    const { data: newMessages, error: insertError } = await supabaseService
      .from('chat_messages')
      .insert([messageData])
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save message' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const newMsg = newMessages?.[0];
    console.log('✅ Message saved:', newMsg);

    return new Response(
      JSON.stringify({ success: true, message: newMsg[0] }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('💥 sendDriverChatMessage error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});