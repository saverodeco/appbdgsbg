import { getPool, sql } from '../../../lib/db';
import { requireUser } from '../../../lib/verifySupabaseUser';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows[] is required' });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  const userTag = user.user_metadata?.display_name || user.email;

  try {
    await transaction.begin();

    for (const row of rows) {
      if (!row.roll_id || !row.plant) {
        throw new Error(`Row missing roll_id/plant: ${JSON.stringify(row)}`);
      }

      // MERGE = SQL Server's upsert. Re-running the same file won't crash
      // on duplicates, it just refreshes those rows instead — same
      // behavior as the old Supabase .upsert() call.
      const mergeReq = new sql.Request(transaction);
      mergeReq.input('rollId', sql.NVarChar, row.roll_id);
      mergeReq.input('plant', sql.NVarChar, row.plant);
      mergeReq.input('kind', sql.NVarChar, row.kind || null);
      mergeReq.input('width', sql.Decimal(10, 2), row.width ?? null);
      mergeReq.input('weight', sql.Decimal(10, 2), row.weight ?? null);
      mergeReq.input('length', sql.Decimal(10, 2), row.length ?? null);
      mergeReq.input('diameter', sql.Decimal(10, 2), row.diameter ?? null);
      mergeReq.input('binLocation', sql.NVarChar, row.bin_location || null);
      mergeReq.input('goodsReceiveDate', sql.DateTime2, row.goods_receive_date ? new Date(row.goods_receive_date) : null);
      mergeReq.input('batch', sql.NVarChar, row.batch || 'AVAILABLE');
      await mergeReq.query(`
        MERGE pr_stock AS target
        USING (SELECT @rollId AS roll_id, @plant AS plant) AS source
        ON target.roll_id = source.roll_id AND target.plant = source.plant
        WHEN MATCHED THEN
          UPDATE SET kind = @kind, width = @width, weight = @weight, length = @length,
                     diameter = @diameter, bin_location = @binLocation,
                     goods_receive_date = @goodsReceiveDate, batch = @batch,
                     updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (roll_id, plant, kind, width, weight, length, diameter, bin_location, goods_receive_date, batch)
          VALUES (@rollId, @plant, @kind, @width, @weight, @length, @diameter, @binLocation, @goodsReceiveDate, @batch);
      `);

      const moveReq = new sql.Request(transaction);
      moveReq.input('rollId', sql.NVarChar, row.roll_id);
      moveReq.input('plant', sql.NVarChar, row.plant);
      moveReq.input('binLocation', sql.NVarChar, row.bin_location || null);
      moveReq.input('weight', sql.Decimal(10, 2), row.weight ?? null);
      moveReq.input('length', sql.Decimal(10, 2), row.length ?? null);
      moveReq.input('diameter', sql.Decimal(10, 2), row.diameter ?? null);
      moveReq.input('userId', sql.NVarChar, userTag);
      await moveReq.query(`
        INSERT INTO pr_stock_movements
          (roll_id, plant, movement_type, initial_loc, destination_loc, weight, length, diameter, user_id)
        VALUES (@rollId, @plant, '101', 'RECEIVE', @binLocation, @weight, @length, @diameter, @userId)
      `);
    }

    await transaction.commit();
    res.status(200).json({ success: true, imported: rows.length });
  } catch (err) {
    await transaction.rollback();
    console.error('gr-import error:', err);
    res.status(500).json({ error: err.message });
  }
}
