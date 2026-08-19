import { getPool, sql } from '../../../lib/db';
import { requireUser } from '../../../lib/verifySupabaseUser';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { rollId, plant, movementId } = req.body || {};
  if (!rollId || !plant || !movementId) {
    return res.status(400).json({ error: 'rollId, plant, and movementId are required' });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const deleteStockReq = new sql.Request(transaction);
    deleteStockReq.input('rollId', sql.NVarChar, rollId);
    deleteStockReq.input('plant', sql.NVarChar, plant);
    await deleteStockReq.query(`
      DELETE FROM pr_stock WHERE roll_id = @rollId AND plant = @plant
    `);

    const deleteMoveReq = new sql.Request(transaction);
    deleteMoveReq.input('movementId', sql.Int, movementId);
    await deleteMoveReq.query(`
      DELETE FROM pr_stock_movements WHERE id = @movementId
    `);

    await transaction.commit();
    res.status(200).json({ success: true });
  } catch (err) {
    await transaction.rollback();
    console.error('cancel-receive error:', err);
    res.status(500).json({ error: err.message });
  }
}
