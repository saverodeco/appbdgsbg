import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../supabase/client';

// Auth is still Supabase Auth (confirmed — the "Firebase" folder in this repo
// isn't what login/signup actually uses). Data now lives in SQL Server via
// pages/api/, but every call still needs the user's Supabase session token
// so the API route can verify who's calling.
const authHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
};

// Field order for the ADUSG ("add a usage") transaction, taken from Mapping_use05505.
// Any field we don't have data for is left as an empty string, so the asterisk
// positions still line up with the mapping spec.
const ADUSG_FIELDS = [
  'dummy', 'system', 'transaction', 'tran_result', 'tran_err_msg', 'tran_ack',
  'tran_date', 'tran_time', 'tran_zone', 'plant_num', 'plant_code', 'plant_name',
  'supplier#', 'sup_code', 'sup_cross_ref', 'order#', 'paper', 'sup_paper',
  'width_uom', 'width', 'con_agent', 'days_ageing', 'currency', 'price_basis',
  'price', 'conversion', 'store', 'location', 'sup_roll_id', 'uniq_roll_id',
  'usage_type', 'program#', 'sold_sup#', 'sold_sup_code', 'used_in',
  'weight_in', 'weight_out', 'weight_used', 'length_in', 'length_out',
  'length_used', 'date_used_start', 'time_used_start', 'import',
  'paper_after_reclassification', 'width_after_reclassification',
  'date_used_finish', 'time_used_finish', 'roll_comment',
  'Cost_In_Roll', 'Cost_Out_Roll', 'Cost_Diff', 'Currency_of_Cost', 'Cost_basis',
  'Local_Cost_Basis', 'Local_Cost_In_Roll', 'Local_Cost_Out_Roll', 'Local_Cost_Diff',
  'Currency_of_Value', 'Value_Basis', 'Value_Basis_2', 'Value_In_Roll',
  'Value_Out_Roll', 'Value_Diff', 'Currency_of_Price', 'Price_Basis',
  'Price_Basis_2', 'Price_In_Roll', 'Price_Out_Roll', 'Price_Diff',
];

// yyMMdd / HHmmss to match the tran_date / tran_time convention seen in the EDI files
const nowDateTimeParts = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(d.getFullYear() % 100)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return { date, time };
};

const buildAdusgLine = (values) => {
  const row = ADUSG_FIELDS.map((key) => (values[key] ?? '').toString());
  // row[0] is 'dummy' (always empty), so join() alone already produces the
  // correct single leading '*' — wrapping with another '*' would double it.
  return row.join('*') + '*';
};

// Field order for the ADMOV ("add a roll movement") / DEMOV ("delete a roll
// movement") transaction, taken from Mapping_mve20434.
const ADMOV_FIELDS = [
  'dummy', 'system', 'transaction', 'tran_result', 'tran_err_msg', 'tran_ack',
  'tran_date', 'tran_time', 'tran_zone', 'plant_num', 'plant_code', 'plant_name',
  'supplier#', 'sup_code', 'sup_cross_ref', 'order#', 'paper', 'sup_paper',
  'width_uom', 'width', 'con_agent', 'days_ageing', 'currency', 'price_basis',
  'price', 'conversion', 'store', 'location', 'sup_roll_id', 'uniq_roll_id',
  'weight', 'length', 'date_moved', 'time_moved', 'docket', 'wagon',
  'times_used', 'from_plant_num', 'from_plant_code', 'from_plant_name',
  'from_store', 'from_location', 'roll_comment',
  'Roll_Cost', 'Local_Cost_Currency', 'Local_Cost_basis', 'Local_Cost_Basis_2',
  'Local_Cost_of_Roll', 'Value_Currency', 'Value_Basis', 'Value_Basis_2',
  'Roll_value', 'Order_Currency', 'Order_Price_Basis', 'Order_Price_Basis_2',
  'Order_Roll_Price',
];

const buildAdmovLine = (values) => {
  const row = ADMOV_FIELDS.map((key) => (values[key] ?? '').toString());
  // row[0] is 'dummy' (always empty), so join() alone already produces the
  // correct single leading '*' — wrapping with another '*' would double it.
  return row.join('*') + '*';
};

const PRIssue = ({ plant }) => {
  const router = useRouter();
  const [machineNumber, setMachineNumber] = useState('C1');
  const [isMachineLocked, setIsMachineLocked] = useState(false);
  const [group, setGroup] = useState('A');
  const [isGroupLocked, setIsGroupLocked] = useState(false);
  const [unitName, setUnitName] = useState('CL');
  const [rollId, setRollId] = useState('');
  const [productionRolls, setProductionRolls] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notFoundAlert, setNotFoundAlert] = useState('');
  const LOG_STORAGE_KEY = 'pr_issue_log_lines';
  const [logLines, setLogLines] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(LOG_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth() || {};

  const fetchProductionRolls = async () => {
    if (!plant) return;
    try {
      const res = await fetch(`/api/pr-stock/production-rolls?plant=${encodeURIComponent(plant)}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch production rolls');
      }
      setProductionRolls(data.rolls);
    } catch (err) {
      setError(`Failed to fetch production rolls: ${err.message}`);
    }
  };

  useEffect(() => {
    if (plant) {
      fetchProductionRolls();
    }
  }, [plant]);

  const appendLog = (line) => {
    setLogLines((prev) => {
      const next = [...prev, line];
      try {
        window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(next));
      } catch (_) {
        // localStorage may be unavailable (private mode, quota exceeded) —
        // the in-memory log still works for the current session either way.
      }
      return next;
    });
  };

  const handleConsume = async (e) => {
    e.preventDefault();
    if (submitting) return; // already processing a previous click — ignore
    if (!rollId || !user || !plant) {
      setError('Roll ID, user, and plant are required.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    setError('');
    setNotFoundAlert('');

    const { date, time } = nowDateTimeParts();
    const userTag = user.user_metadata?.display_name || user.email;
    const destination = `${machineNumber} - ${unitName} - ${group}`;

    try {
      const res = await fetch('/api/pr-stock/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ rollId, plant, destination, userTag }),
      });
      const data = await res.json();

      if (!res.ok) {
        // 404 = not found (with optional nearMatches diagnostic hint),
        // 409 = already in production or ambiguous. Either way, show it.
        let hint = '';
        if (data.nearMatches && data.nearMatches.length > 0) {
          const list = data.nearMatches
            .map((r) => `"${r.roll_id}" (plant ${r.plant})`)
            .join(', ');
          hint = ` Ditemukan kemiripan: ${list}.`;
        }
        setNotFoundAlert(`⚠ ${data.error}${hint}`);
        throw new Error(data.error);
      }

      const { stockData, fullInput } = data;

      // Successful issue = a roll MOVEMENT (bin -> production line), so it
      // logs as ADMOV, using the full scanned value (with prefix) so
      // print/export shows it intact.
      appendLog(buildAdmovLine({
        system: 'RSS',
        transaction: 'ADMOV',
        tran_result: 'OK',
        tran_date: date,
        tran_time: time,
        tran_zone: 'WIB',
        plant_code: plant,
        paper: stockData.kind,
        width: stockData.width,
        store: destination,
        from_plant_code: plant,
        from_store: stockData.bin_location,
        sup_roll_id: fullInput,
        uniq_roll_id: fullInput,
        weight: stockData.weight,
        length: stockData.length,
        date_moved: date,
        time_moved: time,
        roll_comment: userTag,
      }));

      await fetchProductionRolls();
      setMessage(`Roll ${fullInput} successfully moved to production at ${destination}.`);
      setRollId('');
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (roll) => {
    try {
      const res = await fetch('/api/pr-stock/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ rollId: roll.roll_id, plant: roll.plant, binLocation: roll.bin_location }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      const { originalLocation } = data;

      // Cancelling an issue reverses an ADMOV, so log it as DEMOV.
      const { date, time } = nowDateTimeParts();
      const userTag = user?.user_metadata?.display_name || user?.email;
      appendLog(buildAdmovLine({
        system: 'RSS',
        transaction: 'DEMOV',
        tran_result: 'OK',
        tran_date: date,
        tran_time: time,
        tran_zone: 'WIB',
        plant_code: roll.plant,
        paper: roll.kind,
        width: roll.width,
        store: originalLocation,
        from_plant_code: roll.plant,
        from_store: roll.bin_location,
        sup_roll_id: roll.roll_id,
        uniq_roll_id: roll.roll_id,
        weight: roll.weight,
        length: roll.length,
        date_moved: date,
        time_moved: time,
        roll_comment: userTag,
      }));

      await fetchProductionRolls();
      setMessage(`Cancelled issue of roll ${roll.roll_id}.`);
    } catch (error) {
      setError(`Error cancelling issue: ${error.message}`);
    }
  };

  const handleReturn = (roll) => {
    router.push(`/paper-roll/pr-return?roll_id=${roll.roll_id}&bin_location=${roll.bin_location}&plant=${plant}`);
  };

  const handleUsedUp = async (roll) => {
    try {
      const res = await fetch('/api/pr-stock/used-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ rollId: roll.roll_id, plant: roll.plant }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      // "Used Up" is the terminal event — the roll is fully consumed and
      // removed from inventory — so it logs as ADUSG. Assumption: the roll
      // is fully consumed (weight_out/length_out = 0), so weight_in =
      // weight_used = the roll's full weight (same for length). Adjust here
      // if "Used Up" should ever support a partial leftover amount instead.
      const { date, time } = nowDateTimeParts();
      const userTag = user?.user_metadata?.display_name || user?.email;
      appendLog(buildAdusgLine({
        system: 'RSS',
        transaction: 'ADUSG',
        tran_result: 'OK',
        tran_date: date,
        tran_time: time,
        tran_zone: 'WIB',
        plant_code: roll.plant,
        paper: roll.kind,
        width: roll.width,
        location: roll.bin_location,
        sup_roll_id: roll.roll_id,
        uniq_roll_id: roll.roll_id,
        usage_type: 'U',
        used_in: roll.bin_location,
        weight_in: roll.weight,
        weight_out: 0,
        weight_used: roll.weight,
        length_in: roll.length,
        length_out: 0,
        length_used: roll.length,
        date_used_start: date,
        time_used_start: time,
        date_used_finish: date,
        time_used_finish: time,
        roll_comment: userTag,
      }));

      await fetchProductionRolls();
      setMessage(`Roll ${roll.roll_id} marked as used up and removed from stock.`);
    } catch (error) {
      setError(`Error marking roll as used up: ${error.message}`);
    }
  };

  // DD/MM/YY HH:MM:SS — display format for the "# Date/time :" export header,
  // separate from the yyMMdd/HHmmss used inside the ADUSG/ADMOV lines.
  const formattedNowHeader = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yy = pad(d.getFullYear() % 100);
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}`;
  };

  const clearLogSilently = () => {
    setLogLines([]);
    try {
      window.localStorage.removeItem(LOG_STORAGE_KEY);
    } catch (_) {
      // ignore
    }
  };

  const handleExportLog = async () => {
    if (logLines.length === 0) return;
    const header = `# Date/time : ${formattedNowHeader()}\n# Status : Ready\n`;
    const content = header + logLines.join('\n');
    const { date, time } = nowDateTimeParts();
    const suggestedName = `pr_issue_log_${date}_${time}.txt`;

    // File System Access API — lets the user pick the destination folder
    // (e.g. D:\Ekspor) via a native save dialog. Chrome/Edge only.
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{
            description: 'Text file',
            accept: { 'text/plain': ['.txt'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        setMessage(`Log berhasil disimpan ke "${handle.name}".`);
        // Export succeeded — clear so the next transaction starts a fresh
        // log instead of merging into this file on the next export.
        clearLogSilently();
      } catch (err) {
        // AbortError = user cancelled the save dialog — not a real error,
        // and the log is intentionally left intact since nothing was saved.
        if (err.name !== 'AbortError') {
          setError(`Gagal menyimpan log: ${err.message}`);
        }
      }
      return;
    }

    // Fallback for browsers without File System Access API (Firefox, Safari)
    // — downloads to the browser's default download folder as before.
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage(`Log berhasil di-download sebagai "${suggestedName}".`);
    // Same reasoning as above — the browser triggers the download
    // immediately (no cancel step here), so it's safe to clear right away.
    clearLogSilently();
  };

  const handleClearLog = () => {
    if (logLines.length === 0) return;
    if (!window.confirm(`Hapus ${logLines.length} baris log dari perangkat ini? Pastikan sudah di-export dulu.`)) {
      return;
    }
    clearLogSilently();
  };

  return (
    <div>
      <h1>Issue Paper Roll</h1>
      {message && <div className="alert alert-success">{message}</div>}
      {notFoundAlert && <div className="alert alert-danger font-weight-bold">{notFoundAlert}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleConsume}>
        <div className="form-group">
          <label htmlFor="machineNumber">Machine Number</label>
          <div className="input-group">
            <select
              id="machineNumber"
              className="form-control"
              value={machineNumber}
              onChange={(e) => setMachineNumber(e.target.value)}
              disabled={isMachineLocked}
            >
              <option>C1</option>
              <option>C2</option>
            </select>
            <div className="input-group-append">
              <button
                className={`btn ${isMachineLocked ? 'btn-success' : 'btn-outline-secondary'}`}
                type="button"
                onClick={() => setIsMachineLocked(!isMachineLocked)}
              >
                {isMachineLocked ? 'Unlock' : 'Lock'}
              </button>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="group">Group</label>
          <div className="input-group">
            <select
              id="group"
              className="form-control"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              disabled={isGroupLocked}
            >
              <option>A</option>
              <option>B</option>
              <option>C</option>
              <option>D</option>
            </select>
            <div className="input-group-append">
              <button
                className={`btn ${isGroupLocked ? 'btn-success' : 'btn-outline-secondary'}`}
                type="button"
                onClick={() => setIsGroupLocked(!isGroupLocked)}
              >
                {isGroupLocked ? 'Unlock' : 'Lock'}
              </button>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="unitName">Unit Name</label>
          <select
            id="unitName"
            className="form-control"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
          >
            <option>CL</option>
            <option>CM</option>
            <option>BL</option>
            <option>BM</option>
            <option>DB</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="rollId">Scan Roll ID</label>
          <input
            type="text"
            id="rollId"
            className="form-control"
            value={rollId}
            onChange={(e) => setRollId(e.target.value)}
            placeholder="Scan roll barcode"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Processing...' : 'Consume Roll'}
        </button>
      </form>

      <div className="d-flex justify-content-between align-items-center mt-5">
        <h2>Roll on Production</h2>
        <div>
          <button
            className="btn btn-outline-secondary mr-2"
            type="button"
            onClick={handleExportLog}
            disabled={logLines.length === 0}
          >
            Export Log ({logLines.length})
          </button>
          <button
            className="btn btn-outline-danger"
            type="button"
            onClick={handleClearLog}
            disabled={logLines.length === 0}
          >
            Clear Log
          </button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Roll ID</th>
            <th>Kind</th>
            <th>GSM</th>
            <th>Width</th>
            <th>Weight</th>
            <th>Location</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {productionRolls.length > 0 ? (
            productionRolls.map((roll) => (
              <tr key={roll.roll_id}>
                <td>{roll.roll_id}</td>
                <td>{roll.kind}</td>
                <td>{roll.gsm}</td>
                <td>{roll.width}</td>
                <td>{roll.weight}</td>
                <td>{roll.bin_location}</td>
                <td>
                  <button className="btn btn-sm btn-warning mr-2" onClick={() => handleCancel(roll)}>Cancel</button>
                  <button className="btn btn-sm btn-info mr-2" onClick={() => handleReturn(roll)}>Return</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleUsedUp(roll)}>Used Up</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="text-center">No rolls found in production.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PRIssue;
