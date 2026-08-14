// pages/api/pr-stock/production-rolls.js
// GET /api/pr-stock/production-rolls?plant=7025;7027
// Replaces: supabase.from('pr_stock').select('*').in('plant', plantCodes).eq('batch','PRODUCTION')

import { getPool, sql } from '../../../lib/db';
import { requireUser } from '../../../lib/verifySupabaseUser';

const parsePlantCodes = (plant) =>
  (plant || '')
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { plant } = req.query;
  if (!plant) {
    return res.status(400).json({ error: 'plant is required' });
  }

  const plantCodes = parsePlantCodes(plant);
  if (plantCodes.length === 0) {
    return res.status(400).json({ error: 'plant produced no valid codes' });
  }

  try {
    const pool = await getPool();
    const request = pool.request();

    // Parameterized IN clause — never string-concat plant codes directly
    // into the query, even though they come from a trusted prop today.
    const paramNames = plantCodes.map((_, i) => `@plant${i}`);
    plantCodes.forEach((code, i) => request.input(`plant${i}`, sql.NVarChar, code));

    const result = await request.query(`
      SELECT roll_id, plant, weight, gsm, width, length, diameter,
             bin_location, goods_receive_date, kind, batch, updated_at
      FROM pr_stock
      WHERE plant IN (${paramNames.join(',')}) AND batch = 'PRODUCTION'
    `);

    res.status(200).json({ rolls: result.recordset });
  } catch (err) {
    console.error('production-rolls error:', err);
    res.status(500).json({ error: err.message });
  }
}
