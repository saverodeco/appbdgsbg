import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase/client';
import { formatDate } from '../../utils/dateFormatter';

const DeliveryScheduleData = ({ plant }) => {
  const [deliveryScheduleData, setDeliveryScheduleData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortColumn, setSortColumn] = useState('schedule_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedDate, setSelectedDate] = useState('');

  const fetchDeliveryScheduleData = async () => {
    if (!plant || !selectedDate) {
      alert('Please select a plant and a date.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('fg_delivery_schedule')
      .select('id, created_at, so_number, so_item, customer_name, print_design, weight_pcs, outstanding_qty, schedule_date, plant, delivery_quantity, user_name, delivery_status, truck_no, schedule_number, truck_type')
      .eq('plant', plant)
      .eq('schedule_date', selectedDate);

    if (fetchError) {
      setError(fetchError.message || 'Failed to fetch delivery schedule data');
    } else {
      setDeliveryScheduleData(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    setDeliveryScheduleData([]);
  }, [plant]);

  const sortedData = useMemo(() => {
    if (deliveryScheduleData) {
      const sorted = [...deliveryScheduleData].sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
      return sorted;
    }
    return [];
  }, [deliveryScheduleData, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIndicator = (column) => {
    if (sortColumn === column) {
      return sortDirection === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  return (
    <div>
      <h2>Delivery Schedule Data</h2>
      <div>
        <label htmlFor="scheduleDate">Select Schedule Date: </label>
        <input
          type="date"
          id="scheduleDate"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        <button onClick={fetchDeliveryScheduleData} disabled={!selectedDate || !plant}>
          Load Data
        </button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <style jsx>{`
        table, th, td {
          border: 1px solid black;
          border-collapse: collapse;
          padding: 8px;
        }
        table {
          width: 100%;
          margin-top: 1rem;
        }
        th {
          cursor: pointer;
          user-select: none;
        }
        th:hover {
          background-color: #f2f2f2;
        }
        div {
          margin-bottom: 1rem;
        }
      `}</style>
      {deliveryScheduleData.length > 0 && (
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('schedule_number')}>Schedule Number{getSortIndicator('schedule_number')}</th>
              <th onClick={() => handleSort('truck_type')}>Truck Type{getSortIndicator('truck_type')}</th>
              <th onClick={() => handleSort('so_number')}>SO Number{getSortIndicator('so_number')}</th>
              <th onClick={() => handleSort('so_item')}>SO Item{getSortIndicator('so_item')}</th>
              <th onClick={() => handleSort('customer_name')}>Customer Name{getSortIndicator('customer_name')}</th>
              <th onClick={() => handleSort('print_design')}>Print Design{getSortIndicator('print_design')}</th>
              <th onClick={() => handleSort('weight_pcs')}>Weight/Pcs{getSortIndicator('weight_pcs')}</th>
              <th onClick={() => handleSort('outstanding_qty')}>Outstanding Qty{getSortIndicator('outstanding_qty')}</th>
              <th onClick={() => handleSort('schedule_date')}>Schedule Date{getSortIndicator('schedule_date')}</th>
              <th onClick={() => handleSort('plant')}>Plant{getSortIndicator('plant')}</th>
              <th onClick={() => handleSort('delivery_quantity')}>Delivery Quantity{getSortIndicator('delivery_quantity')}</th>
              <th onClick={() => handleSort('user_name')}>User Name{getSortIndicator('user_name')}</th>
              <th onClick={() => handleSort('delivery_status')}>Delivery Status{getSortIndicator('delivery_status')}</th>
              <th onClick={() => handleSort('truck_no')}>Truck No{getSortIndicator('truck_no')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item) => (
              <tr key={item.id}>
                <td>{item.schedule_number}</td>
                <td>{item.truck_type}</td>
                <td>{item.so_number}</td>
                <td>{item.so_item}</td>
                <td>{item.customer_name}</td>
                <td>{item.print_design}</td>
                <td>{item.weight_pcs}</td>
                <td>{item.outstanding_qty}</td>
                <td>{formatDate(item.schedule_date)}</td>
                <td>{item.plant}</td>
                <td>{item.delivery_quantity}</td>
                <td>{item.user_name}</td>
                <td>{item.delivery_status}</td>
                <td>{item.truck_no}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DeliveryScheduleData;
