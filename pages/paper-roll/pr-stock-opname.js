

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';

const StockOpname = () => {
  const [binLocation, setBinLocation] = useState('');
  const [isBinLocked, setIsBinLocked] = useState(false);
  const [rollId, setRollId] = useState('');
  const [scannedRolls, setScannedRolls] = useState([]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Error getting session:', error);
            return;
        }
        setUser(session?.user ?? null);
    };
    fetchUser();
  }, []);

  const handleRollScan = async () => {
    if (!rollId) {
      setMessage('Please enter a Roll ID.');
      return;
    }
    if (!isBinLocked || !binLocation) {
        setMessage('Please lock a bin location before scanning.');
        return;
    }
    if (!user) {
        setMessage('You must be logged in to scan.');
        return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const { data: existingRoll, error: fetchError } = await supabase
        .from('pr_stock')
        .select('roll_id, kind, gsm, width')
        .eq('roll_id', rollId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const { error: insertError } = await supabase
        .from('pr_stock_opname_events')
        .insert({
          scanned_id: rollId,
          bin_location: binLocation,
          opname_at: new Date().toISOString(),
          roll_id: existingRoll ? existingRoll.roll_id : null,
          user_id: user.user_metadata?.display_name || user.email,
        });

      if (insertError) {
        throw insertError;
      }

      if (existingRoll) {
        const rollForUI = { ...existingRoll, id: `db-${rollId}-${Date.now()}` };
        setScannedRolls(prev => [rollForUI, ...prev]);
        setMessage(`Roll ID ${rollId} scanned and recorded successfully.`);
      } else {
        setMessage(`Roll ID ${rollId} not in master data, but recorded in this session.`);
        const newRoll = {
          id: `new-${rollId}-${Date.now()}`,
          roll_id: rollId,
          kind: 'N/A',
          gsm: 'N/A',
          width: 'N/A',
        };
        setScannedRolls(prev => [newRoll, ...prev]);
      }

      setRollId('');

    } catch (error) {
      console.error('Error scanning roll:', error);
      setMessage(`Error scanning roll: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleRollScan();
    }
  };

  const toggleLock = () => {
      if (!binLocation) {
          setMessage("Please enter a bin location before locking.");
          return;
      }
      setIsBinLocked(!isBinLocked);
      setMessage('');
  }

  return (
    <div>
      <h1>Stock Opname</h1>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '10px' }}>
          Bin Location:
          <input
            type="text"
            value={binLocation}
            onChange={e => setBinLocation(e.target.value)}
            disabled={isBinLocked}
            style={{ marginLeft: '5px' }}
          />
        </label>
        <button onClick={toggleLock}>
          {isBinLocked ? 'Change Bin Location' : 'Lock Bin'}
        </button>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '10px' }}>
          Scan Roll ID:
          <input
            type="text"
            value={rollId}
            onChange={e => setRollId(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isBinLocked || isSubmitting}
            placeholder={isBinLocked ? 'Scan here' : 'Lock bin first'}
            style={{ marginLeft: '5px' }}
          />
        </label>
        <button onClick={handleRollScan} disabled={!isBinLocked || isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
      {message && <p>{message}</p>}
      <h2>Scanned Rolls in this Session</h2>
      <table>
        <thead>
          <tr>
            <th>Roll ID</th>
            <th>Kind</th>
            <th>GSM</th>
            <th>Width</th>
          </tr>
        </thead>
        <tbody>
          {scannedRolls.length > 0 ? (
            scannedRolls.map(roll => (
              <tr key={roll.id}>
                <td>{roll.roll_id}</td>
                <td>{roll.kind}</td>
                <td>{roll.gsm}</td>
                <td>{roll.width}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4">
                No rolls scanned yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StockOpname;
