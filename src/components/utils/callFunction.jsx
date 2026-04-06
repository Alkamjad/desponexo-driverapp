import supabase from '@/components/supabaseClient';

const FUNCTIONS_BASE_URL = 'https://desponexodriver.app';

/**
 * ZENTRAL WRAPPER für alle Backend Function Calls
 * 
 * ✅ Automatisches JWT Token Management
 * ✅ Session-Refresh Support
 * ✅ Normalisiertes Error-Handling
 * ✅ Idempotenz-Support (x-client-request-id)
 * ✅ Auto-Logout bei ungültigem Token
 */
export const callFunction = async (functionName, payload = {}, options = {}) => {
  try {
    // 1️⃣ HOLE AKTUELLES SESSION TOKEN (mit Refresh)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // KRITISCH: Wenn keine Session → sauber failen + UI loggt aus
    if (!session?.access_token) {
      console.error(`[callFunction] No auth session for ${functionName}`);
      
      // Logout UI (nur wenn online)
      if (navigator.onLine) {
        await supabase.auth.signOut();
        // Reload Page → User wird zu Login redirected
        window.location.href = '/';
      }
      
      throw {
        code: 'AUTH_ERROR',
        message: 'Session expired. Please login again.',
        statusCode: 401,
        functionName
      };
    }

    // 2️⃣ GENERIERE IDEMPOTENZ-ID (optional)
    const requestId = options.requestId || `${functionName}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // 3️⃣ CHECK ob FormData oder JSON
    const isFormData = payload instanceof FormData;
    
    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      'x-client-request-id': requestId
    };
    
    // FormData setzt Content-Type automatisch (mit boundary)
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    // 4️⃣ API CALL mit vollständigen Headers
    const response = await fetch(`${FUNCTIONS_BASE_URL}/functions/${functionName}`, {
      method: 'POST',
      headers: headers,
      body: isFormData ? payload : JSON.stringify(payload)
    });

    // 5️⃣ PARSE RESPONSE
    const data = await response.json();

    // 6️⃣ ERROR-NORMALISIERUNG
    if (!response.ok) {
      throw {
        code: data?.code || 'FUNCTION_ERROR',
        message: data?.message || data?.error || `Function failed with status ${response.status}`,
        statusCode: response.status,
        functionName,
        details: data?.details || null
      };
    }

    // 7️⃣ SUCCESS RETURN
    return data;
    
  } catch (error) {
    // NORMALISIERE FEHLER FORMAT
    const normalizedError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      statusCode: error.statusCode || 500,
      functionName: functionName,
      timestamp: new Date().toISOString(),
      ...(error.details && { details: error.details })
    };

    console.error(`[callFunction] ${functionName}:`, normalizedError);
    throw normalizedError;
  }
};

export default callFunction;