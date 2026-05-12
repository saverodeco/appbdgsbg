
import React, { useState } from 'react';
import { supabase } from '../../supabase/client';

const OpnameReport = () => {
  const [opnameDate, setOpnameDate] = useState(new Date().toISOString().slice(0, 10));
  const [binLocation, setBinLocation] = useState('');
  const [opnamedRolls, setOpnamedRolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSearch = async () => {
    if (!opnameDate) {
      alert('Please select a date.');
      return;
    }

    setLoading(true);
    setOpnamedRolls([]);
    setMessage('');

    try {
      const startDate = `${opnameDate}T00:00:00.000Z`;
      const endDate = `${opnameDate}T23:59:59.999Z`;

      let query = supabase
        .from('pr_stock_opname_events')
        .select(`
          id,
          opname_at,
          scanned_id,
          bin_location,
          roll_id,
          user_id
        `)
        .gte('opname_at', startDate)
        .lte('opname_at', endDate)
        .order('opname_at', { ascending: false });

      if (binLocation) {
        query = query.ilike('bin_location', `%${binLocation}%`);
      }

      const { data: eventsData, error: eventsError } = await query;

      if (eventsError) {
        throw eventsError;
      }

      const rollIds = [...new Set(eventsData.map(e => e.roll_id).filter(id => id))];

      let rollsMap = new Map();
      if (rollIds.length > 0) {
          const { data: rollsData, error: rollsError } = await supabase
            .from('pr_stock')
            .select('roll_id, kind, gsm, width, diameter, weight, batch, goods_receive_date, bin_location')
            .in('roll_id', rollIds);

          if (rollsError) {
              throw rollsError;
          }
          rollsMap = new Map(rollsData.map(r => [r.roll_id, r]));
      }


      const events = eventsData.map(event => {
        const roll = rollsMap.get(event.roll_id);
        const userName = event.user_id || 'N/A';
        
        if (!roll) {
          return {
            id: event.id,
            opname_at: new Date(event.opname_at).toLocaleString(),
            scanned_roll_id: event.scanned_id,
            scanned_bin_location: event.bin_location,
            user_name: userName,
            kind: 'N/A',
            gsm: 'N/A',
            width: 'N/A',
            diameter: 'N/A',
            weight: 'N/A',
            batch: 'N/A',
            goods_receive_date: 'N/A',
            aging: 'N/A',
            master_bin_location: 'N/A',
          };
        }

        const goodsReceiveDate = roll.goods_receive_date ? new Date(roll.goods_receive_date) : null;
        const aging = goodsReceiveDate ? Math.floor((new Date() - goodsReceiveDate) / (1000 * 60 * 60 * 24)) : 'N/A';

        return {
          id: event.id,
          opname_at: new Date(event.opname_at).toLocaleString(),
          scanned_roll_id: event.scanned_id,
          scanned_bin_location: event.bin_location,
          user_name: userName,
          kind: roll.kind,
          gsm: roll.gsm,
          width: roll.width,
          diameter: roll.diameter,
          weight: roll.weight,
          batch: roll.batch,
          goods_receive_date: goodsReceiveDate ? goodsReceiveDate.toLocaleDateString() : 'N/A',
          aging: aging,
          master_bin_location: roll.bin_location,
        };
      });

      setOpnamedRolls(events);
    } catch (error) {
      console.error('Error searching opnamed rolls:', error);
      alert('Failed to fetch opname report. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId, roll_id) => {
    setMessage('');
    const isConfirmed = window.confirm(`Are you sure you want to delete this scan for Roll ID ${roll_id}?`);
    if (!isConfirmed) {
      return;
    }

    try {
      const { error } = await supabase
        .from('pr_stock_opname_events')
        .delete()
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      setOpnamedRolls(prev => prev.filter(roll => roll.id !== eventId));
      setMessage(`Scan for Roll ID ${roll_id} deleted successfully.`);

    } catch (error) {
      console.error('Error deleting scan:', error);
      setMessage(`Error deleting scan: ${error.message || 'Please try again.'}`);
    }
  };

  return (
    <div>
      <h1>Opname Report</h1>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '10px' }}>
          Opname Date:
          <input
            type="date"
            value={opnameDate}
            onChange={e => setOpnameDate(e.target.value)}
            style={{ marginLeft: '5px' }}
          />
        </label>
        <label style={{ marginRight: '10px' }}>
          Search by Bin Location:
          <input
            type="text"
            value={binLocation}
            onChange={e => setBinLocation(e.target.value)}
            style={{ marginLeft: '5px' }}
          />
        </label>
        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {message && <p>{message}</p>}
      {loading ? (
        <p>Loading report...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Scanned At</th>
              <th>Scanned By</th>
              <th>Scanned Roll ID</th>
              <th>Kind</th>
              <th>GSM</th>
              <th>Width</th>
              <th>Diameter</th>
              <th>Weight</th>
              <th>Batch</th>
              <th>Goods Receive Date</th>
              <th>Aging</th>
              <th>Master Bin Location</th>
              <th>Scanned Bin Location</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {opnamedRolls.length > 0 ? (
              opnamedRolls.map(roll => (
                <tr key={roll.id}>
                  <td>{roll.opname_at}</td>
                  <td>{roll.user_name}</td>
                  <td>{roll.scanned_roll_id}</td>
                  <td>{roll.kind}</td>
                  <td>{roll.gsm}</td>
                  <td>{roll.width}</td>
                  <td>{roll.diameter}</td>
                  <td>{roll.weight}</td>
                  <td>{roll.batch}</td>
                  <td>{roll.goods_receive_date}</td>
                  <td>{roll.aging}</td>
                  <td>{roll.master_bin_location}</td>
                  <td>{roll.scanned_bin_location}</td>
                  <td>
                    <button onClick={() => handleDelete(roll.id, roll.scanned_roll_id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="14">
                  No rolls found for the selected criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default OpnameReport;
