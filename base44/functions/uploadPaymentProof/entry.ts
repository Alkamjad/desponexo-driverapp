import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
// deploy v2

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-auth, x-client-request-id',
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
    const formData = await req.formData();
    const violation_id = formData.get('violation_id');
    const file = formData.get('file');

    if (!violation_id || !file) {
      return new Response(
        JSON.stringify({ success: false, error: 'Violation ID und Datei erforderlich' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('📤 Uploading payment proof for violation:', violation_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseService = createClient(supabaseUrl, serviceKey);

    // Prüfe ob Violation zum Fahrer gehört
    const { data: violation, error: fetchError } = await supabaseService
      .from('traffic_violations')
      .select('id, driver_id, company_id')
      .eq('id', violation_id)
      .eq('driver_id', driver.id)
      .single();

    if (fetchError || !violation) {
      console.error('❌ Violation not found or access denied');
      return new Response(
        JSON.stringify({ success: false, error: 'Strafzettel nicht gefunden oder Zugriff verweigert' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // ✅ FILE VALIDATION (Security Critical)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

    // Size Check
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: 'Datei zu groß (max 10MB)' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // MIME Type Check
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nur PDF, JPG, PNG oder WebP erlaubt' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Extension Check (verhindere path traversal wie "../../.exe")
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ungültige Dateierweiterung' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Filename Sanitization (verhindere null bytes, special chars, path traversal)
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const fileName = `${violation.company_id}/${driver.id}/payment_proof_${violation_id}_${timestamp}.${extension}`;

    console.log('📤 Uploading to traffic-violations bucket:', fileName);

    // Upload zu traffic-violations Bucket mit Service Key
    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('traffic-violations')
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

    console.log('✅ File uploaded, path:', uploadData.path);

    // Eintrag in traffic_violation_files erstellen
    const { error: insertError } = await supabaseService
      .from('traffic_violation_files')
      .insert({
        company_id: violation.company_id,
        violation_id: violation_id,
        file_type: 'PAYMENT_PROOF',
        bucket: 'traffic-violations',
        path: uploadData.path,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size
      });

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      // Cleanup: Lösche hochgeladene Datei
      await supabaseService.storage
        .from('traffic-violations')
        .remove([uploadData.path]);
      
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('✅ Payment proof uploaded and saved');

    return new Response(
      JSON.stringify({ success: true, path: uploadData.path }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('💥 uploadPaymentProof error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});