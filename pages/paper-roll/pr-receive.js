import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../supabase/client';

// Auth is still Supabase Auth — data now goes through pages/api/, but every
// call still needs the user's Supabase session token so the API route can
// verify who's calling.
const authHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
};

// ============================================================================
// Goods Receipt (ADRCV) bulk import — field order taken from the actual
// ADRCV mapping (different from ADMOV: weight_rcv/length_dlv instead of
// weight/length, date_sent/date_rvd instead of date_moved, plus quality
// fields like humidity/porosity).
// ============================================================================
const ADRCV_FIELDS = [
  'dummy', 'system', 'transaction', 'tran_result', 'tran_err_msg', 'tran_ack',
  'tran_date', 'tran_time', 'tran_zone', 'plant_num', 'plant_code', 'plant_name',
  'supplier#', 'sup_code', 'sup_cross_ref', 'order#', 'paper', 'sup_paper',
  'width_uom', 'width', 'currency', 'price_basis', 'price', 'conversion',
  'store', 'location', 'sup_roll_id', 'uniq_roll_id', 'weight_rcv', 'length_dlv',
  'date_sent', 'time_sent', 'docket', 'wagon', 'date_rvd', 'time_rvd',
  'diam_uom', 'diameter', 'import', 'date_intransit', 'time_intransit',
  'humidity', 'porosity', 'fbr_orient', 'slack_edges', 'roll_Comment',
];

// "yyMMdd" + "HHmmss" -> ISO timestamp string, for goods_receive_date.
const parseMoveDateTime = (dateStr, timeStr) => {
  if (!dateStr || dateStr.length !== 6) return null;
  const yy = parseInt(dateStr.slice(0, 2), 10);
  const mm = parseInt(dateStr.slice(2, 4), 10) - 1;
  const dd = parseInt(dateStr.slice(4, 6), 10);
  let hh = 0, mi = 0, ss = 0;
  if (timeStr && timeStr.length === 6) {
    hh = parseInt(timeStr.slice(0, 2), 10);
    mi = parseInt(timeStr.slice(2, 4), 10);
    ss = parseInt(timeStr.slice(4, 6), 10);
  }
  const d = new Date(2000 + yy, mm, dd, hh, mi, ss);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// Parses raw .txt content into pr_stock-ready rows, skipping "#" comment
// lines (the "# Date/time :" / "# Status :" header) and any non-ADRCV lines.
const parseAdrcvText = (text) => {
  const rows = [];
  const skipped = [];

  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const parts = line.split('*');
    const fields = {};
    ADRCV_FIELDS.forEach((key, i) => {
      fields[key] = (parts[i] ?? '').trim();
    });

    if (fields.transaction !== 'ADRCV') {
      skipped.push({ line: idx + 1, reason: `transaction "${fields.transaction}" bukan ADRCV` });
      return;
    }

    const rollId = fields.uniq_roll_id || fields.sup_roll_id;
    const plantCode = fields.plant_code || fields.plant_num;
    if (!rollId || !plantCode) {
      skipped.push({ line: idx + 1, reason: 'roll_id atau plant kosong' });
      return;
    }

    const goodsReceiveDate =
      parseMoveDateTime(fields.date_rvd, fields.time_rvd) ||
      parseMoveDateTime(fields.date_sent, fields.time_sent) ||
      parseMoveDateTime(fields.tran_date, fields.tran_time);

    rows.push({
      roll_id: rollId,
      plant: plantCode,
      kind: fields.paper || null,
      width: fields.width ? parseFloat(fields.width) : null,
      weight: fields.weight_rcv ? parseFloat(fields.weight_rcv) : null,
      length: fields.length_dlv ? parseFloat(fields.length_dlv) : null,
      diameter: fields.diameter ? parseFloat(fields.diameter) : null,
      bin_location: fields.location || fields.store || null,
      goods_receive_date: goodsReceiveDate,
      batch: 'AVAILABLE',
    });
  });

  return { rows, skipped };
};

const PRReceive = ({ plant }) => {
  const [rollId, setRollId] = useState('');
  const [location, setLocation] = useState('');
  const [weight, setWeight] = useState('');
  const [diameter, setDiameter] = useState('');
  const [length, setLength] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth() || {};
  const [sessionReceives, setSessionReceives] = useState([]);

  // --- Goods Receipt (ADRCV) bulk import state ---
  const [grParsedRows, setGrParsedRows] = useState([]);
  const [grSkipped, setGrSkipped] = useState([]);
  const [grFileName, setGrFileName] = useState('');
  const [grImporting, setGrImporting] = useState(false);
  const [grMessage, setGrMessage] = useState('');
  const [grError, setGrError] = useState('');

  const handleReceive = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!user) {
      setError('You must be logged in to receive stock.');
      return;
    }
    if (!plant) {
      setError('Plant information is not available.');
      return;
    }

    try {
      const res = await fetch('/api/pr-stock/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ rollId, plant, location, weight, diameter, length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newReceive = {
        roll_id: rollId,
        plant,
        movement_id: data.movementId,
        location,
        weight,
        diameter,
        length,
      };

      setSessionReceives((prev) => [newReceive, ...prev]);
      setMessage('Roll received successfully!');
      setRollId('');
      setLocation('');
      setWeight('');
      setDiameter('');
      setLength('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancelReceive = async (receive) => {
    try {
      const res = await fetch('/api/pr-stock/cancel-receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          rollId: receive.roll_id,
          plant: receive.plant,
          movementId: receive.movement_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSessionReceives((prev) =>
        prev.filter((r) => !(r.roll_id === receive.roll_id && r.plant === receive.plant))
      );
      setMessage('Receive cancelled.');
    } catch (err) {
      setError(`Error cancelling receive: ${err.message}`);
    }
  };

  // --- Goods Receipt (ADRCV) bulk import handlers ---

  const handleGrFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGrMessage('');
    setGrError('');
    setGrFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const { rows, skipped } = parseAdrcvText(text);
      setGrParsedRows(rows);
      setGrSkipped(skipped);
      if (rows.length === 0) {
        setGrError('Tidak ada baris ADRCV valid yang ditemukan di file ini.');
      }
    };
    reader.onerror = () => {
      setGrError('Gagal membaca file.');
    };
    reader.readAsText(file);
  };

  const handleGrImport = async () => {
    if (grParsedRows.length === 0 || !plant) return;
    setGrImporting(true);
    setGrMessage('');
    setGrError('');

    try {
      const res = await fetch('/api/pr-stock/gr-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ rows: grParsedRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setGrMessage(`${data.imported} roll berhasil di-import ke pr_stock.`);
      setGrParsedRows([]);
      setGrSkipped([]);
      setGrFileName('');
    } catch (err) {
      setGrError(`Gagal import: ${err.message}`);
    } finally {
      setGrImporting(false);
    }
  };

  return (
    <div>
      {/* <h2>Paper Roll Receive</h2>
      {message && <p className="message-success">{message}</p>}
      {error && <p className="message-error">{error}</p>}

      <form onSubmit={handleReceive} className="form-grid">
        <div className="form-group">
          <label htmlFor="rollId">Roll ID:</label>
          <input id="rollId" type="text" value={rollId} onChange={(e) => setRollId(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="location">Location:</label>
          <input id="location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="weight">Weight (kg):</label>
          <input id="weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="diameter">Diameter (mm):</label>
          <input id="diameter" type="number" value={diameter} onChange={(e) => setDiameter(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="length">Length (m):</label>
          <input id="length" type="number" value={length} onChange={(e) => setLength(e.target.value)} required />
        </div>
        <button type="submit">Receive Roll</button>
      </form>

      <h2>Received in this Session</h2>
      <table>
        <thead>
          <tr>
            <th>Roll ID</th>
            <th>Location</th>
            <th>Weight</th>
            <th>Diameter</th>
            <th>Length</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sessionReceives.length > 0 ? (
            sessionReceives.map((rec) => (
              <tr key={`${rec.roll_id}-${rec.plant}`}>
                <td>{rec.roll_id}</td>
                <td>{rec.location}</td>
                <td>{rec.weight}</td>
                <td>{rec.diameter}</td>
                <td>{rec.length}</td>
                <td>
                  <button onClick={() => handleCancelReceive(rec)}>Cancel</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6">No rolls received yet.</td>
            </tr>
          )}
        </tbody>
      </table> */}

      <hr style={{ margin: '2rem 0' }} />

      <h2>Goods Receipt — Import dari .txt</h2>
      

      {grMessage && <p className="message-success">{grMessage}</p>}
      {grError && <p className="message-error">{grError}</p>}

      <div className="form-group">
        <input type="file" accept=".txt" onChange={handleGrFileSelect} />
      </div>

      {grParsedRows.length > 0 && (
        <>
          <p>
            <strong>{grFileName}</strong> — {grParsedRows.length} baris ADRCV siap
            di-import
            {grSkipped.length > 0 && `, ${grSkipped.length} baris dilewati`}.
          </p>

          <table>
            <thead>
              <tr>
                <th>Roll ID</th>
                <th>Plant</th>
                <th>Kind</th>
                <th>Width</th>
                <th>Weight</th>
                <th>Length</th>
                <th>Diameter</th>
                <th>Bin Location</th>
                <th>Goods Receive Date</th>
              </tr>
            </thead>
            <tbody>
              {grParsedRows.map((row) => (
                <tr key={`${row.roll_id}-${row.plant}`}>
                  <td>{row.roll_id}</td>
                  <td>{row.plant}</td>
                  <td>{row.kind}</td>
                  <td>{row.width}</td>
                  <td>{row.weight}</td>
                  <td>{row.length}</td>
                  <td>{row.diameter}</td>
                  <td>{row.bin_location}</td>
                  <td>{row.goods_receive_date}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" onClick={handleGrImport} disabled={grImporting}>
            {grImporting ? 'Importing...' : `Import ${grParsedRows.length} Roll ke Database`}
          </button>
        </>
      )}

      {grSkipped.length > 0 && (
        <details style={{ marginTop: '1rem' }}>
          <summary>{grSkipped.length} baris dilewati (klik untuk detail)</summary>
          <ul>
            {grSkipped.map((s, i) => (
              <li key={i}>Baris {s.line}: {s.reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default PRReceive;
