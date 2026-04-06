import { createClient } from 'npm:@supabase/supabase-js@2';

// CORS Headers - RESTRICTED
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://desponexodriver.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-supabase-auth, x-client-request-id',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

// 🔐 Verify user is authenticated
async function verifyRequest(req) {
  try {
    const supabaseToken = req.headers.get('x-supabase-auth');
    const authHeader = req.headers.get('Authorization') || '';
    const token = supabaseToken || (authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null);
    if (!token) {
      return { valid: false, status: 401, error: 'Missing auth token' };
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      return { valid: false, status: 500, error: 'Server config missing' };
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('❌ AUTH ERROR:', error?.message);
      return { valid: false, status: 401, error: 'Invalid token' };
    }
    
    // Get driver_id
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: driver, error: driverError } = await supabaseService
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (driverError || !driver) {
      return { valid: false, status: 403, error: 'Driver not found' };
    }
    
    return { valid: true, driver_id: driver.id, user_id: user.id };
  } catch (error) {
    console.error('❌ VERIFY REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401, error: error.message };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const auth = await verifyRequest(req);
    if (!auth.valid) {
      return Response.json(
        { success: false, error: auth.error },
        { status: auth.status, headers: corsHeaders }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        { success: false, error: 'Missing Supabase credentials' },
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse FormData
    const formData = await req.formData();
    const file = formData.get('file');
    const tourId = formData.get('tour_id');
    const fileType = formData.get('file_type'); // 'signature', 'photo', etc.

    if (!file || !tourId || !fileType) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Konvertiere File zu ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Generiere eindeutigen Dateinamen
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'png';
    const fileName = `${tourId}/${fileType}_${timestamp}.${extension}`;

    // Upload zu Supabase Storage
    const { data, error } = await supabase.storage
      .from('tour-documentation')
      .upload(fileName, uint8Array, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }

    // Erstelle Public URL
    const { data: publicUrlData } = supabase.storage
      .from('tour-documentation')
      .getPublicUrl(fileName);

    return Response.json(
      { 
        success: true, 
        file_url: publicUrlData.publicUrl,
        file_path: fileName
      },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
});