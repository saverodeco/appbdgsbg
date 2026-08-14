// pages/api/pr-stock/cancel.js
// POST /api/pr-stock/cancel
// Body: { rollId, plant, binLocation }
// Replaces handleCancel() in pr-issue.js — finds the last '201' issue
// movement matching the roll's current bin_location, reverts pr_stock back
// to its original location, and deletes that movement record.

import { getPool, sql } from '../../../lib/db';
import { requireUser } from '../../../lib/verifySupabaseUser';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { rollId, plant, binLocation } = req.body || {};
  if (!rollId || !plant || !binLocation) {
    return res.status(400).json({ error: 'rollId, plant, and binLocation are required' });
  }

  try {
    const pool = await getPool();

    const findRequest = pool.request();
    findRequest.input('rollId', sql.NVarChar, rollId);
    findRequest.input('destinationLoc', sql.NVarChar, binLocation);
    const findResult = await findRequest.query(`
      SELECT TOP 1 id, initial_loc, batch FROM pr_stock_movements
      WHERE roll_id = @rollId AND movement_type = '201' AND destination_loc = @destinationLoc
      ORDER BY [timestamp] DESC
    `);

    if (findResult.recordset.length === 0) {
      return res.status(404).json({
        error: `Could not find the specific 'issue' movement to cancel for roll ${rollId}. It may have been cancelled already.`,
      });
    }

    const movement = findResult.recordset[0];
    const originalLocation = movement.initial_loc;
    if (!originalLocation) {
      return res.status(422).json({
        error: `Original location for roll ${rollId} is missing from its movement history.`,
      });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const updateRequest = new sql.Request(transaction);
      updateRequest.input('rollId', sql.NVarChar, rollId);
      updateRequest.input('plant', sql.NVarChar, plant);
      updateRequest.input('binLocation', sql.NVarChar, originalLocation);
      updateRequest.input('batch', sql.NVarChar, movement.batch);
      await updateRequest.query(`
        UPDATE pr_stock SET bin_location = @binLocation, batch = @batch
        WHERE roll_id = @rollId AND plant = @plant
      `);

      const deleteRequest = new sql.Request(transaction);
      deleteRequest.input('id', sql.Int, movement.id);
      await deleteRequest.query(`DELETE FROM pr_stock_movements WHERE id = @id`);

      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

    res.status(200).json({ originalLocation });
  } catch (err) {
    console.error('cancel error:', err);
    res.status(500).json({ error: err.message });
  }
}
