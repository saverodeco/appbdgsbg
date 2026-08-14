// lib/verifySupabaseUser.js
// The app's login/signup still uses Supabase Auth (confirmed — not Firebase),
// even though the actual data now lives in SQL Server. API routes must
// verify the caller's Supabase access token themselves, since there's no
// RLS anymore to do it automatically the way Supabase's direct client
// access used to.
//
// The frontend must send the token on every call:
//   const { data: { session } } = await supabase.auth.getSession();
//   fetch('/api/...', { headers: { Authorization: `Bearer ${session.access_token}` } })
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as server-side env
// vars (never exposed to the browser) — the service role key is what lets
// this verify tokens without needing the anon key/RLS.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verifies the Authorization header on an API route request.
 * Returns the Supabase user object on success, or null if invalid/missing.
 */
export async function verifySupabaseUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Convenience wrapper: verifies auth and sends a 401 response itself if it
 * fails, so route handlers can just `const user = await requireUser(req, res); if (!user) return;`
 */
export async function requireUser(req, res) {
  const user = await verifySupabaseUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized — invalid or missing session.' });
    return null;
  }
  return user;
}
