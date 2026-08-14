const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// ============================================================================
// manageUserAuthority — server-side authority/permission management
// ============================================================================
// Runs with the Supabase service_role key (never exposed to the browser) so
// it can read/update ANY row in user_profiles, bypassing that table's RLS
// policies which otherwise only let a user see/edit their own profile.
//
// Setup required before this works:
//   1. cd firebase/functions && npm install @supabase/supabase-js
//   2. firebase functions:secrets:set SUPABASE_URL
//   3. firebase functions:secrets:set SUPABASE_SERVICE_ROLE_KEY
//      (use the service_role key from Supabase project settings -> API,
//      NOT the anon/public key)
//   4. firebase deploy --only functions:manageUserAuthority
//
// One-time bootstrap: since nobody currently has the ac-authority-manager
// permission, this function will reject everyone at first. Manually set
// permissions = ["ac-authority-manager"] for your own row in the Supabase
// Table Editor once — after that, everything can be managed through the app.
// ============================================================================

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = defineSecret('SUPABASE_URL');
const supabaseServiceRoleKey = defineSecret('SUPABASE_SERVICE_ROLE_KEY');

exports.manageUserAuthority = onCall(
  { secrets: [supabaseUrl, supabaseServiceRoleKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Anda harus login.');
    }

    const supabaseAdmin = createClient(
      supabaseUrl.value(),
      supabaseServiceRoleKey.value()
    );

    const callerId = request.auth.uid;

    // 1. Verify the caller actually has the ac-authority-manager permission.
    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from('user_profiles')
      .select('permissions')
      .eq('id', callerId)
      .single();

    if (callerError || !callerProfile) {
      throw new HttpsError('permission-denied', 'Profil Anda tidak ditemukan.');
    }

    const callerPermissions = callerProfile.permissions || [];
    if (!callerPermissions.includes('ac-authority-manager')) {
      throw new HttpsError(
        'permission-denied',
        'Anda tidak memiliki izin ac-authority-manager.'
      );
    }

    const { action } = request.data || {};

    // 2. List all users + their current permissions.
    if (action === 'list') {
      const { data: users, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, permissions')
        .order('email', { ascending: true });

      if (error) throw new HttpsError('internal', error.message);
      return { users: users || [] };
    }

    // 3. Get a single user's data (used by the edit page).
    if (action === 'get') {
      const { userId } = request.data;
      if (!userId) {
        throw new HttpsError('invalid-argument', 'userId wajib diisi.');
      }

      const { data: user, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, permissions')
        .eq('id', userId)
        .single();

      if (error) throw new HttpsError('internal', error.message);
      return { user };
    }

    // 4. Update a user's permissions array.
    if (action === 'update') {
      const { userId, permissions } = request.data;
      if (!userId || !Array.isArray(permissions)) {
        throw new HttpsError(
          'invalid-argument',
          'userId dan permissions[] wajib diisi.'
        );
      }

      const { data: updated, error } = await supabaseAdmin
        .from('user_profiles')
        .update({ permissions, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select();

      if (error) throw new HttpsError('internal', error.message);
      if (!updated || updated.length === 0) {
        throw new HttpsError('not-found', `User ${userId} tidak ditemukan.`);
      }
      return { updated: updated[0] };
    }

    throw new HttpsError('invalid-argument', `Action tidak dikenal: ${action}`);
  }
);

// Add more cloud functions below as needed.