import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://desponexodriver.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

// 🔐 Verify user is authenticated
async function verifyRequest(req) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, status: 401, error: 'Missing or invalid Authorization header' };
    }
    
    const token = authHeader.replace('Bearer ', '').trim();
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

    console.log('📤 Upload request received from driver:', auth.driver_id);
    
    const formData = await req.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'driver_files';

    console.log('📦 FormData:', { 
      hasFile: !!file, 
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      driver_id: auth.driver_id,
      folder
    });

    if (!file) {
      console.error('❌ Missing file');
      return Response.json(
        { error: 'file erforderlich' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase config missing');
      return Response.json(
        { error: 'Supabase config missing' },
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Dateiname mit Timestamp (driver_id statt email)
    const timestamp = Date.now();
    const originalName = file.name || 'audio.webm';
    const extension = originalName.split('.').pop() || 'webm';
    const fileName = `${auth.driver_id}_${timestamp}.${extension}`;
    const filePath = `${folder}/${fileName}`;

    console.log('📁 Uploading to:', filePath);

    // Upload zu Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    console.log('💾 Buffer size:', fileBuffer.byteLength);
    
    // Bestimme Content-Type
    let contentType = file.type || 'application/octet-stream';
    if (extension === 'webm' && !contentType.includes('audio')) {
      contentType = 'audio/webm';
    }
    
    const { data, error } = await supabase.storage
      .from('driver-uploads')
      .upload(filePath, fileBuffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error('❌ Upload error:', error);
      return Response.json(
        { error: error.message, details: error },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('✅ Upload success:', data);

    // Public URL generieren
    const { data: urlData } = supabase.storage
      .from('driver-uploads')
      .getPublicUrl(filePath);

    console.log('🔗 Public URL:', urlData.publicUrl);

    return Response.json(
      { success: true, file_url: urlData.publicUrl },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('💥 Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
});