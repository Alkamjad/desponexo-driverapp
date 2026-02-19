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
      .select('id')
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
    return { valid: true, driver_id: driver.id, user_id: user.id };
  } catch (error) {
    console.error('❌ VERIFY REQUEST EXCEPTION:', error.message);
    return { valid: false, status: 401 };
  }
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    const body = await req.json();
    const { messageIds } = body;
    
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'messageIds array erforderlich' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const driver_id = auth.driver_id;
    const now = new Date().toISOString();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Update Messages
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: updatedMessages, error: updateError } = await supabaseService
      .from('chat_messages')
      .update({
        is_read: true,
        read_at: now
      })
      .in('id', messageIds)
      .eq('driver_id', driver_id)
      .select();

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update messages' }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated_count: updatedMessages?.length || 0
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('markChatAsRead error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});