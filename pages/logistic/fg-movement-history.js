import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';

const FGMovementHistory = ({ plant }) => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userId, setUserId] = useState('');
  const [movementType, setMovementType] = useState('');

  // State for sorting
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'descending' });

  const fetchMovements = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('fg_stock_movements')
        .select('*')
        .eq('plant', plant);

      // Apply filters
      if (startDate) {
        query = query.gte('timestamp', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('timestamp', `${endDate}T23:59:59`);
      }
      if (userId) {
        query = query.ilike('user_id', `%${userId}%`);
      }
      if (movementType) {
        query = query.eq('movement_type', movementType);
      }

      // Apply sorting
      query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setMovements(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on initial load, or when plant/sorting changes
  useEffect(() => {
    if (plant) {
        fetchMovements();
    }
  }, [plant, sortConfig]);

  // Handler to trigger a fetch when the filter button is clicked
  const handleFilter = () => {
    fetchMovements();
  }

  // Handler to update sorting state
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Helper to visually indicate sorting direction
  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    }
    return '';
  };

  return (
    <div>
      <h1>Finished Goods Movement History</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input
          type="text"
          placeholder="Search by User ID"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <select
          value={movementType}
          onChange={e => setMovementType(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
        >
            <option value="">All Types</option>
            <option value="201">201</option>
            <option value="202">202</option>
            <option value="101">101</option>
            <option value="102">102</option>
            <option value="601">601</option>
            <option value="602">602</option>
            <option value="999">999</option>
        </select>
        <button onClick={handleFilter} style={{ padding: '5px' }}>Filter</button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <table>
        <thead>
          <tr>
            <th onClick={() => requestSort('timestamp')} style={{ cursor: 'pointer' }}>Timestamp{getSortIndicator('timestamp')}</th>
            <th onClick={() => requestSort('lmg_number')} style={{ cursor: 'pointer' }}>LMG Number{getSortIndicator('lmg_number')}</th>
            <th onClick={() => requestSort('so_number')} style={{ cursor: 'pointer' }}>SO Number{getSortIndicator('so_number')}</th>
            <th onClick={() => requestSort('so_item')} style={{ cursor: 'pointer' }}>SO Item{getSortIndicator('so_item')}</th>
            <th onClick={() => requestSort('movement_type')} style={{ cursor: 'pointer' }}>Movement Type{getSortIndicator('movement_type')}</th>
            <th onClick={() => requestSort('initial_loc')} style={{ cursor: 'pointer' }}>Initial Location{getSortIndicator('initial_loc')}</th>
            <th onClick={() => requestSort('destination_loc')} style={{ cursor: 'pointer' }}>Destination Location{getSortIndicator('destination_loc')}</th>
            <th onClick={() => requestSort('user_id')} style={{ cursor: 'pointer' }}>User ID{getSortIndicator('user_id')}</th>
            <th onClick={() => requestSort('quantity')} style={{ cursor: 'pointer' }}>Quantity{getSortIndicator('quantity')}</th>
          </tr>
        </thead>
        <tbody>
          {movements.map(movement => (
            <tr key={movement.id}>
              <td>{new Date(movement.timestamp).toLocaleString()}</td>
              <td>{movement.lmg_number}</td>
              <td>{movement.so_number}</td>
              <td>{movement.so_item}</td>
              <td>{movement.movement_type}</td>
              <td>{movement.initial_loc}</td>
              <td>{movement.destination_loc}</td>
              <td>{movement.user_id}</td>
              <td>{movement.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FGMovementHistory;