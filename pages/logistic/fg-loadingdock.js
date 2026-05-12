import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import Link from 'next/link';
import { finalizeShipment, cancelItemGroup } from '../../hooks/useShipment';

const FGLoadingDock = ({ plant }) => {
  const { session } = useAuth() || {};
  const [loadingData, setLoadingData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchLoadingData = async () => {
    if (!plant) return;

    try {
      const { data, error } = await supabase
        .from('fg_loading')
        .select('*')
        .eq('plant', plant)
        .in('status', ['Waiting', 'Loading']);

      if (error) throw error;

      const groupedByTruck = data.reduce((acc, item) => {
        if (!acc[item.truck_no]) {
          acc[item.truck_no] = [];
        }
        acc[item.truck_no].push(item);
        return acc;
      }, {});

      setLoadingData(groupedByTruck);
    } catch (error) {
      setError(`Error fetching loading data: ${error.message}`);
    }
  };

  useEffect(() => {
    if (plant) {
      fetchLoadingData();
      const channel = supabase.channel('fg_loading_changes');
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fg_loading' }, () => {
          fetchLoadingData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [plant]);

  const handleFinalizeShipment = async (truckNoToFinalize) => {
    setError('');
    setSuccess('');
    const result = await finalizeShipment(session, plant, truckNoToFinalize);
    if (result.success) {
      setSuccess(result.message);
      fetchLoadingData();
    } else {
      setError(result.message);
    }
  };

  const handleCancelItemGroup = async (truckNo, item) => {
    setError('');
    setSuccess('');
    const result = await cancelItemGroup({ truckNo, soNumber: item.so_number, soItem: item.so_item });
    if (result.success) {
      setSuccess(result.message);
      fetchLoadingData();
    } else {
      setError(result.message);
    }
  };

  return (
    <div>
      <h2>FG Loading Dock</h2>
      
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="mb-3">
        <Link href="/logistic/fg-loading" passHref>
          <button className="btn btn-primary">Add New Truck</button>
        </Link>
      </div>

      <h3>Live Loading View</h3>
      {Object.keys(loadingData).length > 0 ? (
        <div className="card">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Truck No.</th>
                  <th>SO Number</th>
                  <th>SO Item</th>
                  <th>Total Quantity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(loadingData).map(([truck, items]) => {
                  const aggregatedItems = items.reduce((acc, item) => {
                    const existing = acc.find(i => i.so_number === item.so_number && i.so_item === item.so_item);
                    if (existing) {
                      existing.quantity += item.quantity;
                    } else {
                      acc.push({ ...item });
                    }
                    return acc;
                  }, []);

                  return aggregatedItems.map((item, index) => (
                    <tr key={`${truck}-${item.so_number}-${item.so_item}`}>
                      {index === 0 && (
                        <td rowSpan={aggregatedItems.length}>{truck}</td>
                      )}
                      <td>{item.so_number}</td>
                      <td>{item.so_item}</td>
                      <td>{item.quantity}</td>
                      {index === 0 && (
                        <td rowSpan={aggregatedItems.length}>
                           <Link href={`/logistic/fg-loading?truck_no=${truck}`} passHref>
                            <button className="btn btn-info btn-sm">Add Item</button>
                          </Link>
                          <button className="btn btn-success btn-sm ms-1" onClick={() => handleFinalizeShipment(truck)}>Finalize Shipment</button>
                          <button className="btn btn-danger btn-sm ms-1" onClick={() => handleCancelItemGroup(truck, item)}>Cancel</button>
                        </td>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p>No trucks are currently being loaded.</p>
      )}
    </div>
  );
};

export default FGLoadingDock;
