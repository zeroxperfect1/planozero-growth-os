export const contentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

export function securityHeaders(production) {
  return (_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (production) {
      res.set('Content-Security-Policy', contentSecurityPolicy);
      res.set('Strict-Transport-Security', 'max-age=31536000');
    }
    next();
  };
}

// JSON-only writes plus exact origin checks. Non-browser clients may omit Origin;
// browsers must not initiate writes from a sibling origin or a cross-site page.
export function allowedWriteOrigin(req) {
  const site = req.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.get('origin');
  if (!origin) return true;
  try {
    const expected = new URL(`${req.protocol}://${req.get('host')}`).origin;
    const parsed = new URL(origin);
    return parsed.origin === expected && origin === parsed.origin;
  } catch {
    return false;
  }
}
