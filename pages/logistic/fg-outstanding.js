import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '../../supabase/client';
import { formatDate } from '../../utils/dateFormatter';

const ScheduledDeliveriesData = ({ plant }) => {
  const [deliveryScheduleData, setDeliveryScheduleData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortColumn, setSortColumn] = useState('schedule_number');
  const [sortDirection, setSortDirection] = useState('asc');

  const fetchDeliveryScheduleData = async () => {
    if (!plant) {
      alert('Please select a plant.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('fg_delivery_schedule')
      .select('id, created_at, so_number, so_item, customer_name, print_design, weight_pcs, outstanding_qty, schedule_date, plant, delivery_quantity, delivery_status, truck_no, schedule_number, truck_type')
      .eq('plant', plant)
      .in('delivery_status', ['Scheduled', 'Loading', 'PartialCarryover']);

    if (fetchError) {
      setError(fetchError.message || 'Failed to fetch delivery schedule data');
    } else {
      setDeliveryScheduleData(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if(plant){
        fetchDeliveryScheduleData();
    }
  }, [plant]);

  const processedData = useMemo(() => {
    if (!deliveryScheduleData) return [];

    // 1. Augment data with weight calculation
    const dataWithWeight = deliveryScheduleData.map(item => ({
      ...item,
      weight: (item.weight_pcs || 0) * (item.outstanding_qty || 0),
    }));

    // 2. Calculate total weight for each schedule number
    const totalWeights = dataWithWeight.reduce((acc, item) => {
      const key = item.schedule_number;
      if (key) {
        acc[key] = (acc[key] || 0) + item.weight;
      }
      return acc;
    }, {});

    // 3. Add total_weight to each item
    const dataWithAllCalcs = dataWithWeight.map(item => ({
      ...item,
      total_weight: item.schedule_number ? totalWeights[item.schedule_number] : 0,
    }));

    // 4. Sort the data
    const sortedData = [...dataWithAllCalcs].sort((a, b) => {
      // Primary sort by schedule_number to keep groups together
      const scheduleA = a.schedule_number || '';
      const scheduleB = b.schedule_number || '';
      let scheduleCompare = String(scheduleA).localeCompare(String(scheduleB), undefined, { numeric: true });

      // If sorting by schedule_number itself, apply direction and finish
      if (sortColumn === 'schedule_number' && scheduleCompare !== 0) {
        return sortDirection === 'asc' ? scheduleCompare : -scheduleCompare;
      }
      
      // If schedule numbers are different, use that for grouping (always ascending)
      if (scheduleCompare !== 0) {
        return scheduleCompare;
      }
      
      // If schedule numbers are the same, use the user-selected column for sorting
      const valA = sortColumn === 'weight' ? a.weight : (sortColumn === 'total_weight' ? a.total_weight : a[sortColumn]);
      const valB = sortColumn === 'weight' ? b.weight : (sortColumn === 'total_weight' ? b.total_weight : b[sortColumn]);

      let comparison = 0;
      if (valA < valB) comparison = -1;
      if (valA > valB) comparison = 1;

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // 5. Add rowspan info for grouped display
    const withRowspan = [];
    let i = 0;
    while (i < sortedData.length) {
      let rowspan = 1;
      if (sortedData[i].schedule_number) {
        for (let j = i + 1; j < sortedData.length; j++) {
          if (sortedData[i].schedule_number === sortedData[j].schedule_number) {
            rowspan++;
          } else {
            break;
          }
        }
      }

      withRowspan.push({ ...sortedData[i], rowspan, isFirstInGroup: true });

      for (let k = 1; k < rowspan; k++) {
        withRowspan.push({ ...sortedData[i + k], rowspan: 0, isFirstInGroup: false });
      }
      i += rowspan;
    }

    return withRowspan;
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
      <h2>Scheduled Deliveries</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <style jsx>{`
        table, th, td {
          border: 1px solid black;
          border-collapse: collapse;
          padding: 8px;
          text-align: left;
          vertical-align: top;
        }
        table {
          width: 100%;
          margin-top: 1rem;
        }
        th {
          cursor: pointer;
          user-select: none;
          position: sticky;
          top: 0;
          background-color: #f2f2f2;
        }
        th:hover {
          background-color: #e2e2e2;
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
              <th onClick={() => handleSort('total_weight')}>Total Weight{getSortIndicator('total_weight')}</th>
              <th onClick={() => handleSort('schedule_date')}>Schedule Date{getSortIndicator('schedule_date')}</th>
              <th onClick={() => handleSort('so_number')}>SO Number{getSortIndicator('so_number')}</th>
              <th onClick={() => handleSort('so_item')}>SO Item{getSortIndicator('so_item')}</th>
              <th onClick={() => handleSort('customer_name')}>Customer Name{getSortIndicator('customer_name')}</th>
              <th onClick={() => handleSort('print_design')}>Print Design{getSortIndicator('print_design')}</th>
              <th onClick={() => handleSort('weight')}>Weight{getSortIndicator('weight')}</th>
              <th onClick={() => handleSort('outstanding_qty')}>Outstanding Qty{getSortIndicator('outstanding_qty')}</th>
              <th onClick={() => handleSort('truck_no')}>Truck No{getSortIndicator('truck_no')}</th>
              <th onClick={() => handleSort('delivery_quantity')}>Delivery Quantity{getSortIndicator('delivery_quantity')}</th>
              <th onClick={() => handleSort('delivery_status')}>Delivery Status{getSortIndicator('delivery_status')}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map((item) => (
              <tr key={item.id}>
                {item.isFirstInGroup && <td rowSpan={item.rowspan}>{item.schedule_number}</td>}
                {item.isFirstInGroup && <td rowSpan={item.rowspan}>{item.truck_type}</td>}
                {item.isFirstInGroup && <td rowSpan={item.rowspan}>{item.total_weight.toFixed(2)}</td>}
                <td>{formatDate(item.schedule_date)}</td>
                <td>{item.so_number}</td>
                <td>{item.so_item}</td>
                <td>{item.customer_name}</td>
                <td>{item.print_design}</td>
                <td>{item.weight.toFixed(2)}</td>
                <td>{item.outstanding_qty}</td>
                <td>{item.truck_no}</td>
                <td>{item.delivery_quantity}</td>
                <td>{item.delivery_status}</td>
                <td>
                  <Link href={`/logistic/fg-loading?so_number=${item.so_number}&so_item=${item.so_item}`} passHref>
                    <button>Send Item</button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ScheduledDeliveriesData;
