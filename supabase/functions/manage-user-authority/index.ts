// supabase/functions/manage-user-authority/index.ts
//
// Deploy with:
//   npx supabase login
//   npx supabase link --project-ref YOUR_PROJECT_REF
//   npx supabase functions deploy manage-user-authority
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Supabase Edge Runtime — no manual secret setup needed.
//
// One-time bootstrap: since nobody currently has the ac-authority-manager
// permission, this function will reject everyone at first. Manually set
// permissions = ["ac-authority-manager"] for your own row in the Supabase
// Table Editor once — after that, everything can be managed through the app.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Adjust for your actual frontend origin(s) in production.
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({}, 200);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Anda harus login.' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace('Bearer ', '');

    // Verify the caller's JWT and resolve their user id.
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Token tidak valid atau sudah kedaluwarsa.' }, 401);
    }
    const callerId = authData.user.id;

    // 1. Verify the caller actually has the ac-authority-manager permission.
    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from('user_profiles')
      .select('permissions')
      .eq('id', callerId)
      .single();

    if (callerError || !callerProfile) {
      return jsonResponse({ error: 'Profil Anda tidak ditemukan.' }, 403);
    }

    const callerPermissions: string[] = callerProfile.permissions || [];
    if (!callerPermissions.includes('ac-authority-manager')) {
      return jsonResponse({ error: 'Anda tidak memiliki izin ac-authority-manager.' }, 403);
    }

    const body = await req.json();
    const { action } = body;

    // 2. List all users + their current permissions.
    if (action === 'list') {
      const { data: users, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, permissions')
        .order('email', { ascending: true });

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ users: users || [] });
    }

    // 3. Get a single user's data (used by the edit page).
    if (action === 'get') {
      const { userId } = body;
      if (!userId) {
        return jsonResponse({ error: 'userId wajib diisi.' }, 400);
      }

      const { data: targetUser, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, permissions')
        .eq('id', userId)
        .single();

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ user: targetUser });
    }

    // 4. Update a user's permissions array.
    if (action === 'update') {
      const { userId, permissions } = body;
      if (!userId || !Array.isArray(permissions)) {
        return jsonResponse({ error: 'userId dan permissions[] wajib diisi.' }, 400);
      }

      const { data: updated, error } = await supabaseAdmin
        .from('user_profiles')
        .update({ permissions, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select();

      if (error) return jsonResponse({ error: error.message }, 500);
      if (!updated || updated.length === 0) {
        return jsonResponse({ error: `User ${userId} tidak ditemukan.` }, 404);
      }
      return jsonResponse({ updated: updated[0] });
    }

    return jsonResponse({ error: `Action tidak dikenal: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return jsonResponse({ error: message }, 500);
  }
});