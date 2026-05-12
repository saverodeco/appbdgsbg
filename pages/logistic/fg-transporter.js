import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';

const FGTransporter = () => {
  const [transporters, setTransporters] = useState([]);
  const [truckNo, setTruckNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const fetchTransporters = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('fg_transporter').select('*');
    if (error) {
      setError(error.message);
    } else {
      setTransporters(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTransporters();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError(null);
    if (!truckNo) {
      setError('Truck number cannot be empty.');
      return;
    }

    const { error: insertError } = await supabase.from('fg_transporter').insert([{ truck_no: truckNo }]);

    if (insertError) {
      setError(insertError.message);
    } else {
      setMessage(`Truck number '${truckNo}' added successfully.`);
      setTruckNo('');
      fetchTransporters(); // Refresh the list
    }
  };

  return (
    <div>
      <h2>FG Transporter Management</h2>

      <div className="card mb-4">
        <div className="card-header">Add New Transporter</div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-4">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter new truck number"
                  value={truckNo}
                  onChange={(e) => setTruckNo(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <button type="submit" className="btn btn-primary">Add Truck</button>
              </div>
            </div>
          </form>
          {message && <div className="alert alert-success mt-3">{message}</div>}
          {error && <div className="alert alert-danger mt-3">{error}</div>}
        </div>
      </div>

      <h3>Current Transporters</h3>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Truck No</th>
              <th>Truck Type</th>
              <th>Driver Name</th>
              <th>Driver Number</th>
              <th>Expedition</th>
              <th>Dimension (LxWxH)</th>
            </tr>
          </thead>
          <tbody>
            {transporters.map((t) => (
              <tr key={t.truck_no}>
                <td>{t.truck_no}</td>
                <td>{t.truck_type}</td>
                <td>{t.driver_name}</td>
                <td>{t.driver_number}</td>
                <td>{t.expedition}</td>
                <td>{`${t.dimension_length || 'N/A'} x ${t.dimension_width || 'N/A'} x ${t.dimension_height || 'N/A'}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FGTransporter;
