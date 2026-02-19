export function getCorsHeaders(options: { methods?: string; headers?: string; includeJsonContentType?: boolean } = {}) {
  const {
    methods = 'POST, OPTIONS',
    headers = 'Content-Type, Authorization',
    includeJsonContentType = true
  } = options;

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': headers,
    'Access-Control-Allow-Credentials': 'true'
  };

  if (includeJsonContentType) {
    corsHeaders['Content-Type'] = 'application/json';
  }

  return corsHeaders;
}
