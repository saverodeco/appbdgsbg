import { useState } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';

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
      // Check if the roll already exists
      const { data: existingRoll, error: fetchError } = await supabase
        .from('pr_stock')
        .select('roll_id')
        .eq('roll_id', rollId)
        .eq('plant', plant)
        .single();

      if (existingRoll) {
        throw new Error(`Roll ID ${rollId} already exists in plant ${plant}.`);
      }

      const receiveDate = new Date().toISOString();

      // Insert into pr_stock
      const { data: stockData, error: stockInsertError } = await supabase
        .from('pr_stock')
        .insert({
          roll_id: rollId,
          plant: plant,
          bin_location: location,
          weight: weight,
          diameter: diameter,
          length: length,
          goods_receive_date: receiveDate,
          user_id: user.user_metadata.display_name || user.email,
        })
        .select()
        .single();

      if (stockInsertError) {
        throw stockInsertError;
      }

      // Insert into pr_stock_movements
      const { data: movementData, error: movementError } = await supabase
        .from('pr_stock_movements')
        .insert({
          roll_id: rollId,
          plant: plant,
          movement_type: '101', // Goods Receipt
          initial_loc: 'RECEIVE',
          destination_loc: location,
          weight: weight,
          diameter: diameter,
          length: length,
          user_id: user.user_metadata.display_name || user.email,
        })
        .select()
        .single();

      if (movementError) {
        throw movementError;
      }

      const newReceive = {
        stock_id: stockData.id,
        movement_id: movementData.id,
        roll_id: rollId,
        location: location,
        weight: weight,
        diameter: diameter,
        length: length,
      };

      setSessionReceives(prevReceives => [newReceive, ...prevReceives]);

      setMessage('Roll received successfully!');
      setRollId('');
      setLocation('');
      setWeight('');
      setDiameter('');
      setLength('');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleCancelReceive = async (receive) => {
    try {
      // Delete from pr_stock
      const { error: stockDeleteError } = await supabase
        .from('pr_stock')
        .delete()
        .eq('id', receive.stock_id);

      if (stockDeleteError) {
        throw stockDeleteError;
      }

      // Delete from pr_stock_movements
      const { error: movementDeleteError } = await supabase
        .from('pr_stock_movements')
        .delete()
        .eq('id', receive.movement_id);

      if (movementDeleteError) {
        throw movementDeleteError;
      }

      setSessionReceives(prevReceives => prevReceives.filter(r => r.stock_id !== receive.stock_id));
      setMessage('Receive cancelled.');
    } catch (error) {
      setError(`Error cancelling receive: ${error.message}`);
    }
  };

  return (
    <div>
      <h2>Paper Roll Receive</h2>
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
            sessionReceives.map(rec => (
              <tr key={rec.stock_id}>
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
      </table>
    </div>
  );
};

export default PRReceive;
