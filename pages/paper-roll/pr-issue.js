import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';

const PRIssue = ({ plant }) => {
  const router = useRouter();
  const [machineNumber, setMachineNumber] = useState('C1');
  const [isMachineLocked, setIsMachineLocked] = useState(false);
  const [group, setGroup] = useState('A');
  const [isGroupLocked, setIsGroupLocked] = useState(false);
  const [unitName, setUnitName] = useState('CL');
  const [rollId, setRollId] = useState('');
  const [productionRolls, setProductionRolls] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth() || {};

  // Fetches all rolls with the 'PRODUCTION' batch status for the current plant
  const fetchProductionRolls = async () => {
    if (!plant) return;
    const { data, error } = await supabase
      .from('pr_stock')
      .select('*')
      .eq('plant', plant)
      .eq('batch', 'PRODUCTION');

    if (error) {
      setError(`Failed to fetch production rolls: ${error.message}`);
    } else {
      setProductionRolls(data);
    }
  };

  // Refreshes the list of production rolls whenever the component loads or the plant changes
  useEffect(() => {
    if (plant) {
      fetchProductionRolls();
    }
  }, [plant]);

  // Handles the consumption of a paper roll
  const handleConsume = async (e) => {
    e.preventDefault();
    if (!rollId || !user || !plant) {
      setError('Roll ID, user, and plant are required.');
      return;
    }

    setMessage('');
    setError('');

    try {
      // Retrieve the stock data for the given roll ID and plant
      const { data: stockData, error: fetchError } = await supabase
        .from('pr_stock')
        .select('*')
        .eq('roll_id', rollId)
        .eq('plant', plant)
        .single();

      if (fetchError || !stockData) {
        throw new Error(`Roll ID ${rollId} not found in plant ${plant}.`);
      }

      const destination = `${machineNumber} - ${unitName} - ${group}`;

      // Create a new record in the pr_stock_movements table to log the consumption
      const { error: movementError } = await supabase.from('pr_stock_movements').insert([
        {
          roll_id: stockData.roll_id,
          plant: plant,
          movement_type: '201', // 201 represents consumption
          initial_loc: stockData.bin_location,
          destination_loc: destination,
          weight: -stockData.weight,
          diameter: -stockData.diameter,
          length: -stockData.length,
          prod_order_no: stockData.prod_order_no,
          batch: stockData.batch,
          user_id: user.user_metadata.display_name || user.email,
        },
      ]);

      if (movementError) {
        throw new Error(`Failed to record movement: ${movementError.message}`);
      }

      // Update the bin location and batch of the roll in the pr_stock table
      const { error: updateError } = await supabase
        .from('pr_stock')
        .update({ bin_location: destination, batch: 'PRODUCTION' })
        .eq('roll_id', rollId)
        .eq('plant', plant);

      if (updateError) {
        throw new Error(`Failed to update roll location: ${updateError.message}. Manual correction may be needed.`);
      }

      await fetchProductionRolls();
      setMessage(`Roll ${rollId} successfully moved to production at ${destination}.`);
      setRollId('');
    } catch (error) {
      setError(error.message);
    }
  };

  // Handles the cancellation of a roll issue
  const handleCancel = async (roll) => {
    try {
      // Find the issue movement to be cancelled
      const { data: issueMovement, error: movementError } = await supabase
        .from('pr_stock_movements')
        .select('id, initial_loc, batch')
        .eq('roll_id', roll.roll_id)
        .eq('movement_type', '201')
        .eq('destination_loc', roll.bin_location)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (movementError || !issueMovement) {
        throw new Error(`Could not find the specific 'issue' movement to cancel for roll ${roll.roll_id}. It may have been cancelled already.`);
      }

      const originalLocation = issueMovement.initial_loc;
      if (!originalLocation) {
          throw new Error(`Original location for roll ${roll.roll_id} is missing from its movement history.`);
      }

      // Revert the bin location and batch of the roll in the pr_stock table
      const { error: updateError } = await supabase
        .from('pr_stock')
        .update({ bin_location: originalLocation, batch: issueMovement.batch })
        .eq('roll_id', roll.roll_id);

      if (updateError) {
        throw new Error(`Failed to revert stock location: ${updateError.message}`);
      }

      // Delete the movement record from the pr_stock_movements table
      const { error: deleteError } = await supabase
        .from('pr_stock_movements')
        .delete()
        .eq('id', issueMovement.id);

      if (deleteError) {
        throw new Error(`Failed to delete the movement history record: ${deleteError.message}.`);
      }

      await fetchProductionRolls();
      setMessage(`Cancelled issue of roll ${roll.roll_id}.`);
    } catch (error) {
      setError(`Error cancelling issue: ${error.message}`);
    }
  };

  const handleReturn = (roll) => {
    router.push(`/paper-roll/pr-return?roll_id=${roll.roll_id}&bin_location=${roll.bin_location}&plant=${plant}`);
  };

  const handleUsedUp = async (roll) => {
    try {
      const { error } = await supabase
        .from('pr_stock')
        .delete()
        .eq('roll_id', roll.roll_id);

      if (error) {
        throw error;
      }

      await fetchProductionRolls();
      setMessage(`Roll ${roll.roll_id} marked as used up and removed from stock.`);
    } catch (error) {
      setError(`Error marking roll as used up: ${error.message}`);
    }
  };

  return (
    <div>
      <h1>Issue Paper Roll</h1>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleConsume}>
        <div className="form-group">
          <label htmlFor="machineNumber">Machine Number</label>
          <div className="input-group">
            <select
              id="machineNumber"
              className="form-control"
              value={machineNumber}
              onChange={(e) => setMachineNumber(e.target.value)}
              disabled={isMachineLocked}
            >
              <option>C1</option>
              <option>C2</option>
            </select>
            <div className="input-group-append">
              <button
                className={`btn ${isMachineLocked ? 'btn-success' : 'btn-outline-secondary'}`}
                type="button"
                onClick={() => setIsMachineLocked(!isMachineLocked)}
              >
                {isMachineLocked ? 'Unlock' : 'Lock'}
              </button>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="group">Group</label>
          <div className="input-group">
            <select
              id="group"
              className="form-control"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              disabled={isGroupLocked}
            >
              <option>A</option>
              <option>B</option>
              <option>C</option>
              <option>D</option>
            </select>
            <div className="input-group-append">
              <button
                className={`btn ${isGroupLocked ? 'btn-success' : 'btn-outline-secondary'}`}
                type="button"
                onClick={() => setIsGroupLocked(!isGroupLocked)}
              >
                {isGroupLocked ? 'Unlock' : 'Lock'}
              </button>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="unitName">Unit Name</label>
          <select
            id="unitName"
            className="form-control"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
          >
            <option>CL</option>
            <option>CM</option>
            <option>BL</option>
            <option>BM</option>
            <option>DB</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="rollId">Scan Roll ID</label>
          <input
            type="text"
            id="rollId"
            className="form-control"
            value={rollId}
            onChange={(e) => setRollId(e.target.value)}
            placeholder="Scan roll barcode"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary">
          Consume Roll
        </button>
      </form>

      <h2 className="mt-5">Roll on Production</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Roll ID</th>
            <th>Kind</th>
            <th>GSM</th>
            <th>Width</th>
            <th>Weight</th>
            <th>Location</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {productionRolls.length > 0 ? (
            productionRolls.map((roll) => (
              <tr key={roll.roll_id}>
                <td>{roll.roll_id}</td>
                <td>{roll.kind}</td>
                <td>{roll.gsm}</td>
                <td>{roll.width}</td>
                <td>{roll.weight}</td>
                <td>{roll.bin_location}</td>
                <td>
                  <button className="btn btn-sm btn-warning mr-2" onClick={() => handleCancel(roll)}>Cancel</button>
                  <button className="btn btn-sm btn-info mr-2" onClick={() => handleReturn(roll)}>Return</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleUsedUp(roll)}>Used Up</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="text-center">No rolls found in production.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PRIssue;