// pages/api/pr-stock/used-up.js
// POST /api/pr-stock/used-up
// Body: { rollId, plant }
// Replaces handleUsedUp() in pr-issue.js — removes the roll from pr_stock
// entirely (it's fully consumed, nothing left to track).

import { getPool, sql } from '../../../lib/db';
import { requireUser } from '../../../lib/verifySupabaseUser';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { rollId, plant } = req.body || {};
  if (!rollId || !plant) {
    return res.status(400).json({ error: 'rollId and plant are required' });
  }

  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('rollId', sql.NVarChar, rollId);
    request.input('plant', sql.NVarChar, plant);

    // OUTPUT DELETED.* captures the row as it was right before deletion, so
    // the frontend has what it needs (kind/width/weight/length/bin_location)
    // to build its ADUSG log line without a separate lookup.
    const result = await request.query(`
      DELETE FROM pr_stock
      OUTPUT DELETED.*
      WHERE roll_id = @rollId AND plant = @plant
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: `Roll ${rollId} not found in plant ${plant}.` });
    }

    res.status(200).json({ success: true, deletedRoll: result.recordset[0] });
  } catch (err) {
    console.error('used-up error:', err);
    res.status(500).json({ error: err.message });
  }
}
