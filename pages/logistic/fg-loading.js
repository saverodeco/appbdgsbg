import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import { addItemToTruck, deleteItemFromTruck, finalizeShipment } from '../../hooks/useShipment';

const FGLoading = ({ plant }) => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [soItem, setSoItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loadingData, setLoadingData] = useState([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const router = useRouter();
  const { session } = useAuth() || {};
  const { truck_no: truckNoFromQuery, so_number: soNumberFromQuery, so_item: soItemFromQuery } = router.query;

  const fetchLoadingData = async () => {
    if (!truckNo || !plant) return;

    try {
      const { data, error } = await supabase
        .from('fg_loading')
        .select('*')
        .eq('plant', plant)
        .eq('truck_no', truckNo)
        .eq('status', 'Loading')
        .order('id', { ascending: false });

      if (error) throw error;
      setLoadingData(data);
    } catch (error) {
      setError(`Error fetching loading data: ${error.message}`);
    }
  };

  useEffect(() => {
    if (truckNoFromQuery) {
      setTruckNo(truckNoFromQuery);
    }
    if (soNumberFromQuery) {
      setSoNumber(soNumberFromQuery);
    }
    if (soItemFromQuery) {
      setSoItem(soItemFromQuery);
    }
  }, [truckNoFromQuery, soNumberFromQuery, soItemFromQuery]);

  useEffect(() => {
    if (truckNo && plant) {
      fetchLoadingData();
      const channel = supabase.channel(`fg_loading_changes_${truckNo}`);
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fg_loading', filter: `truck_no=eq.${truckNo}` }, () => {
          fetchLoadingData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [truckNo, plant]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!truckNo || !soNumber || !soItem || !quantity) {
      setError('All fields are required.');
      return;
    }

    if (!plant) {
      setError('Cannot determine plant. Please make sure you are logged in and have a plant assigned.');
      return;
    }

    const result = await addItemToTruck({ truckNo, soNumber, soItem, quantity, plant });

    if (result.success) {
      setSuccess(result.message);
      if (!soNumberFromQuery) {
        setSoNumber('');
      }
      if (!soItemFromQuery) {
        setSoItem('');
      }
      setQuantity('');
      fetchLoadingData();
    } else {
      setError(result.message);
    }
  };

  const handleDeleteItem = async (itemId, soNumber, soItem) => {
    setError('');
    setSuccess('');
    const result = await deleteItemFromTruck({ itemId, soNumber, soItem });
    if (result.success) {
      setSuccess(result.message);
      fetchLoadingData();
    } else {
      setError(result.message);
    }
  };

  const handleFinalizeShipment = async () => {
    setError('');
    setSuccess('');
    setIsFinalizing(true);
    const result = await finalizeShipment(session, plant, truckNo);
    if (result.success) {
      setSuccess(result.message);
      fetchLoadingData();
    } else {
      setError(result.message);
    }
    setIsFinalizing(false);
  };

  const handleBackToLoadingDock = () => {
    router.push('/logistic/fg-loadingdock');
  };

  const canFinalize = loadingData.length > 0 && loadingData.some(item => item.status === 'Loading');

  return (
    <div>
      <div className="d-flex justify-content-between mb-3">
        <button className="btn btn-secondary" onClick={handleBackToLoadingDock}>
          Back to Loading Dock
        </button>
        <button
          className="btn btn-success"
          onClick={handleFinalizeShipment}
          disabled={isFinalizing || !canFinalize}
        >
          {isFinalizing ? 'Finalizing...' : 'Finalize Shipment'}
        </button>
      </div>

      <h2>FG Loading</h2>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleAddItem} className="card mb-4">
        <div className="card-header">Add Item to Truck</div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-3">
              <input type="text" className="form-control" placeholder="Truck No." value={truckNo} onChange={e => setTruckNo(e.target.value)} disabled={!!truckNoFromQuery} />
            </div>
            <div className="col-md-3">
              <input type="text" className="form-control" placeholder="SO Number" value={soNumber} onChange={e => setSoNumber(e.target.value)} disabled={!!soNumberFromQuery} />
            </div>
            <div className="col-md-2">
              <input type="text" className="form-control" placeholder="SO Item" value={soItem} onChange={e => setSoItem(e.target.value)} disabled={!!soItemFromQuery} />
            </div>
            <div className="col-md-2">
              <input type="number" className="form-control" placeholder="Quantity" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100">Add Item</button>
            </div>
          </div>
        </div>
      </form>

      <h3>Items on this Truck</h3>
      {loadingData.length > 0 ? (
        <div className="card">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>SO Number</th>
                  <th>SO Item</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingData.map(item => (
                  <tr key={item.id}>
                    <td>{item.so_number}</td>
                    <td>{item.so_item}</td>
                    <td>{item.quantity}</td>
                    <td>{item.status}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteItem(item.id, item.so_number, item.so_item)}
                        disabled={item.status !== 'Loading'}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p>No items have been added to this truck yet.</p>
      )}
    </div>
  );
};

export default FGLoading;