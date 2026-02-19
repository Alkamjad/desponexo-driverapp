type CorsOptions = {
  methods?: string;
  headers?: string;
  includeJsonContentType?: boolean;
};

function resolveAllowedOrigin() {
  const configuredOrigin = Deno.env.get('ALLOWED_ORIGIN')?.trim();
  const allowAllCors = Deno.env.get('ALLOW_ALL_CORS') === 'true';

  if (allowAllCors) {
    return '*';
  }

  // Fail-closed default for production safety when ALLOWED_ORIGIN is missing.
  return configuredOrigin || 'null';
}

export function getCorsHeaders(options: CorsOptions = {}) {
  const {
    methods = 'POST, OPTIONS',
    headers = 'Content-Type, Authorization',
    includeJsonContentType = true
  } = options;

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': resolveAllowedOrigin(),
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': headers,
    'Access-Control-Allow-Credentials': 'true'
  };

  if (includeJsonContentType) {
    corsHeaders['Content-Type'] = 'application/json';
  }

  return corsHeaders;
}
