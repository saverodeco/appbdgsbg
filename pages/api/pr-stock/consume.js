// pages/api/pr-stock/consume.js
// POST /api/pr-stock/consume
// Body: { rollId, plant, destination, userTag }
// Replaces the whole find -> insert movement -> update stock sequence from
// handleConsume() in pr-issue.js. Runs as a single SQL transaction — an
// improvement over the old Supabase version, where those two writes were
// NOT atomic (a crash between them could leave inconsistent data).

import { getPool, sql } from '../../../lib/db';
import { requireUser } from '../../../lib/verifySupabaseUser';

const parsePlantCodes = (plant) =>
  (plant || '')
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);

// pr_stock stores roll_id WITHOUT its leading 2-letter prefix (e.g.
// "830383"), but the physical roll is scanned/typed with the prefix (e.g.
// "LA830383"). dbRollId is what we query/update; fullInput stays for
// display/log purposes on the frontend (this function only needs dbRollId).
const parseRollInput = (input) => {
  const trimmed = (input || '').trim();
  const hasLetterPrefix = /^[A-Za-z]{2}/.test(trimmed);
  return {
    fullInput: trimmed,
    dbRollId: hasLetterPrefix ? trimmed.slice(2) : trimmed,
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { rollId, plant, destination, userTag } = req.body || {};
  if (!rollId || !plant || !destination) {
    return res.status(400).json({ error: 'rollId, plant, and destination are required' });
  }

  const { fullInput, dbRollId } = parseRollInput(rollId);
  const plantCodes = parsePlantCodes(plant);
  if (plantCodes.length === 0) {
    return res.status(400).json({ error: 'plant produced no valid codes' });
  }

  try {
    const pool = await getPool();

    // 1. Find the roll across the allowed plants
    const findRequest = pool.request();
    findRequest.input('rollId', sql.NVarChar, dbRollId);
    const paramNames = plantCodes.map((_, i) => `@plant${i}`);
    plantCodes.forEach((code, i) => findRequest.input(`plant${i}`, sql.NVarChar, code));

    const findResult = await findRequest.query(`
      SELECT * FROM pr_stock
      WHERE roll_id = @rollId AND plant IN (${paramNames.join(',')})
    `);

    if (findResult.recordset.length === 0) {
      // Not found — same diagnostic LIKE search as the old ILIKE lookup, to
      // help catch typos or whitespace in the stored roll_id.
      const hintRequest = pool.request();
      hintRequest.input('like', sql.NVarChar, `%${dbRollId}%`);
      const hintResult = await hintRequest.query(`
        SELECT roll_id, plant FROM pr_stock WHERE roll_id LIKE @like
      `);

      return res.status(404).json({
        error: `Roll ${fullInput} tidak ditemukan di database untuk plant ${plant}.`,
        nearMatches: hintResult.recordset,
      });
    }

    if (findResult.recordset.length > 1) {
      return res.status(409).json({
        error: `Roll ${fullInput} ditemukan di lebih dari satu baris (ambigu) — periksa data pr_stock.`,
      });
    }

    const stockData = findResult.recordset[0];

    // Already issued — re-consuming would create a duplicate movement/log
    // entry (e.g. "moved" from its current location to the same location).
    if (stockData.batch === 'PRODUCTION') {
      return res.status(409).json({
        error: `Roll ${fullInput} sudah tercatat di production (lokasi: ${stockData.bin_location}). Tidak diproses ulang.`,
      });
    }

    // 2. Insert movement + update stock atomically
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const movementRequest = new sql.Request(transaction);
      movementRequest.input('rollId', sql.NVarChar, stockData.roll_id);
      movementRequest.input('plant', sql.NVarChar, stockData.plant);
      movementRequest.input('initialLoc', sql.NVarChar, stockData.bin_location);
      movementRequest.input('destinationLoc', sql.NVarChar, destination);
      movementRequest.input('weight', sql.Decimal(10, 2), stockData.weight != null ? -stockData.weight : null);
      movementRequest.input('diameter', sql.Decimal(10, 2), stockData.diameter != null ? -stockData.diameter : null);
      movementRequest.input('length', sql.Decimal(10, 2), stockData.length != null ? -stockData.length : null);
      movementRequest.input('batch', sql.NVarChar, stockData.batch);
      movementRequest.input('userId', sql.NVarChar, userTag || 'unknown');

      await movementRequest.query(`
        INSERT INTO pr_stock_movements
          (roll_id, plant, movement_type, initial_loc, destination_loc, weight, diameter, length, batch, user_id)
        VALUES
          (@rollId, @plant, '201', @initialLoc, @destinationLoc, @weight, @diameter, @length, @batch, @userId)
      `);

      const updateRequest = new sql.Request(transaction);
      updateRequest.input('rollId', sql.NVarChar, stockData.roll_id);
      updateRequest.input('plant', sql.NVarChar, stockData.plant);
      updateRequest.input('binLocation', sql.NVarChar, destination);

      await updateRequest.query(`
        UPDATE pr_stock SET bin_location = @binLocation, batch = 'PRODUCTION'
        WHERE roll_id = @rollId AND plant = @plant
      `);

      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

    res.status(200).json({ stockData, fullInput, destination });
  } catch (err) {
    console.error('consume error:', err);
    res.status(500).json({ error: err.message });
  }
}
