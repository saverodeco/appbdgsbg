import { useState } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';

const PRMovement = ({ plant }) => {
  const [rollId, setRollId] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth() || {};
  const [sessionMovements, setSessionMovements] = useState([]);

  const handleMovement = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!user) {
      setError('You must be logged in to move stock.');
      return;
    }
    if (!plant) {
        setError('Plant information is not available.');
        return;
    }

    try {
      const { data: stockData, error: stockError } = await supabase
        .from('pr_stock')
        .select('*')
        .eq('roll_id', rollId)
        .eq('plant', plant)
        .single();

      if (stockError || !stockData) {
        throw new Error(`Roll ID ${rollId} not found in plant ${plant}.`);
      }

      const { data: movementData, error: movementError } = await supabase.from('pr_stock_movements').insert([
        {
          roll_id: rollId,
          plant: plant,
          movement_type: '999',
          initial_loc: stockData.bin_location,
          destination_loc: newLocation,
          weight: 0,
          diameter: stockData.diameter,
          length: stockData.length,
          prod_order_no: stockData.prod_order_no,
          user_id: user.user_metadata.display_name || user.email,
        },
      ]).select();

      if (movementError) {
        throw movementError;
      }

      const { error: updateError } = await supabase
        .from('pr_stock')
        .update({ bin_location: newLocation })
        .eq('roll_id', rollId)
        .eq('plant', plant);

      if (updateError) {
        throw updateError;
      }

      const newMovement = {
        id: movementData[0].id,
        roll_id: rollId,
        initial_loc: stockData.bin_location,
        destination_loc: newLocation,
      };
      setSessionMovements(prevMovements => [newMovement, ...prevMovements]);

      setMessage('Movement successful!');
      setRollId('');
      setNewLocation('');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleCancelMovement = async (movement) => {
    try {
      // Revert the bin location in pr_stock
      const { error: updateError } = await supabase
        .from('pr_stock')
        .update({ bin_location: movement.initial_loc })
        .eq('roll_id', movement.roll_id)
        .eq('plant', plant);

      if (updateError) {
        throw updateError;
      }

      // Delete the movement from pr_stock_movements
      const { error: deleteError } = await supabase
        .from('pr_stock_movements')
        .delete()
        .eq('id', movement.id);

      if (deleteError) {
        throw deleteError;
      }

      // Remove the movement from the session movements in the UI
      setSessionMovements(prevMovements => prevMovements.filter(m => m.id !== movement.id));
      setMessage('Movement cancelled.');
    } catch (error) {
      setError(`Error cancelling movement: ${error.message}`);
    }
  };


  return (
    <div>
      <h2>Paper Roll Movement</h2>
      {message && <p className="message-success">{message}</p>}
      {error && <p className="message-error">{error}</p>}

      <form onSubmit={handleMovement} className="form-grid">
        <div className="form-group">
          <label htmlFor="rollId">Roll ID:</label>
          <input
            id="rollId"
            type="text"
            value={rollId}
            onChange={(e) => setRollId(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="newLocation">New Location:</label>
          <input
            id="newLocation"
            type="text"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            required
          />
        </div>
        <button type="submit">Move Roll</button>
      </form>

      <h2>Movements in this Session</h2>
      <table>
        <thead>
          <tr>
            <th>Roll ID</th>
            <th>From</th>
            <th>To</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sessionMovements.length > 0 ? (
            sessionMovements.map(move => (
              <tr key={move.id}>
                <td>{move.roll_id}</td>
                <td>{move.initial_loc}</td>
                <td>{move.destination_loc}</td>
                <td>
                  <button onClick={() => handleCancelMovement(move)}>Cancel</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4">
                No movements in this session yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PRMovement;
