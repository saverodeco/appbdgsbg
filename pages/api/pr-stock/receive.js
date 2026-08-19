import { getPool, sql } from '../../../lib/db';
import { requireUser } from '../../../lib/verifySupabaseUser';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { rollId, plant, location, weight, diameter, length } = req.body || {};
  if (!rollId || !plant || !location) {
    return res.status(400).json({ error: 'rollId, plant, and location are required' });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  const userTag = user.user_metadata?.display_name || user.email;

  try {
    await transaction.begin();

    // 1. Reject if the roll already exists (composite PK roll_id + plant).
    const checkReq = new sql.Request(transaction);
    checkReq.input('rollId', sql.NVarChar, rollId);
    checkReq.input('plant', sql.NVarChar, plant);
    const existing = await checkReq.query(`
      SELECT roll_id FROM pr_stock WHERE roll_id = @rollId AND plant = @plant
    `);
    if (existing.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({ error: `Roll ID ${rollId} already exists in plant ${plant}.` });
    }

    // 2. Insert into pr_stock.
    const insertStockReq = new sql.Request(transaction);
    insertStockReq.input('rollId', sql.NVarChar, rollId);
    insertStockReq.input('plant', sql.NVarChar, plant);
    insertStockReq.input('location', sql.NVarChar, location);
    insertStockReq.input('weight', sql.Decimal(10, 2), weight || null);
    insertStockReq.input('diameter', sql.Decimal(10, 2), diameter || null);
    insertStockReq.input('length', sql.Decimal(10, 2), length || null);
    await insertStockReq.query(`
      INSERT INTO pr_stock (roll_id, plant, bin_location, weight, diameter, length, goods_receive_date, batch)
      VALUES (@rollId, @plant, @location, @weight, @diameter, @length, SYSUTCDATETIME(), 'AVAILABLE')
    `);

    // 3. Insert into pr_stock_movements — OUTPUT gives us the new id so the
    //    frontend can reference it later (e.g. to cancel this receive).
    const insertMoveReq = new sql.Request(transaction);
    insertMoveReq.input('rollId', sql.NVarChar, rollId);
    insertMoveReq.input('plant', sql.NVarChar, plant);
    insertMoveReq.input('location', sql.NVarChar, location);
    insertMoveReq.input('weight', sql.Decimal(10, 2), weight || null);
    insertMoveReq.input('diameter', sql.Decimal(10, 2), diameter || null);
    insertMoveReq.input('length', sql.Decimal(10, 2), length || null);
    insertMoveReq.input('userId', sql.NVarChar, userTag);
    const moveResult = await insertMoveReq.query(`
      INSERT INTO pr_stock_movements
        (roll_id, plant, movement_type, initial_loc, destination_loc, weight, diameter, length, user_id)
      OUTPUT INSERTED.id
      VALUES (@rollId, @plant, '101', 'RECEIVE', @location, @weight, @diameter, @length, @userId)
    `);

    await transaction.commit();

    res.status(200).json({
      success: true,
      roll: { roll_id: rollId, plant, location, weight, diameter, length },
      movementId: moveResult.recordset[0].id,
    });
  } catch (err) {
    await transaction.rollback();
    console.error('receive error:', err);
    res.status(500).json({ error: err.message });
  }
}
