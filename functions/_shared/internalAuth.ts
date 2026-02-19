export function verifyInternalRequest(req: Request) {
  const expectedSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');

  if (!expectedSecret) {
    return { valid: false, status: 500, error: 'INTERNAL_FUNCTION_SECRET missing' };
  }

  const requestSecret = req.headers.get('x-internal-secret') || '';
  if (requestSecret !== expectedSecret) {
    return { valid: false, status: 401, error: 'Unauthorized internal request' };
  }

  return { valid: true };
}
