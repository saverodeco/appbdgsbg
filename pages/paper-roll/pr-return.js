import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';

const PRReturn = ({ plant }) => {
  const router = useRouter();
  const { roll_id: queryRollId, bin_location } = router.query;
  const [rollId, setRollId] = useState('');
  const [location, setLocation] = useState('');
  const [diameter, setDiameter] = useState('');
  const [initialWeight, setInitialWeight] = useState('');
  const [initialDiameter, setInitialDiameter] = useState('');
  const [initialGsm, setInitialGsm] = useState('');
  const [initialWidth, setInitialWidth] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth() || {};

  const fetchRollData = async (currentRollId) => {
    if (!currentRollId || !plant) return;

    setError('');
    const { data, error } = await supabase
      .from('pr_stock')
      .select('roll_id, weight, diameter, gsm, width')
      .eq('roll_id', currentRollId)
      .eq('plant', plant)
      .single();

    if (error) {
      setError(`Roll ID ${currentRollId} not found in plant ${plant}.`);
      setInitialWeight('');
      setInitialDiameter('');
      setInitialGsm('');
      setInitialWidth('');
    } else if (data) {
      setRollId(data.roll_id);
      setInitialWeight(data.weight);
      setInitialDiameter(data.diameter);
      setInitialGsm(data.gsm);
      setInitialWidth(data.width);
    }
  };

  const fetchOriginalLocation = async (currentRollId) => {
    if (!currentRollId || !plant) return;

    // Find the last 'issue' movement to get the original storage location.
    const { data, error } = await supabase
        .from('pr_stock_movements')
        .select('initial_loc')
        .eq('roll_id', currentRollId)
        .eq('plant', plant)
        .eq('movement_type', '201') // '201' for 'issue to production'
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        console.error('Original location not found. User must enter it manually.');
        setLocation(''); // Default to empty if not found
    } else {
        // Set the default return location to where it was before being issued.
        setLocation(data.initial_loc);
    }
  };

  useEffect(() => {
    if (queryRollId && plant) {
      setRollId(queryRollId);
      fetchRollData(queryRollId);
      fetchOriginalLocation(queryRollId);
    }
  }, [queryRollId, plant]);

  const handleRollIdBlur = () => {
    if (!queryRollId && rollId) {
      fetchRollData(rollId);
      fetchOriginalLocation(rollId);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleRollIdBlur();
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    if (!user) {
        setError('You must be logged in to return stock.');
        return;
    }
    if (!plant) {
        setError('Plant information is not available.');
        return;
    }
    if (!diameter || !location) {
        setError('Return Diameter and Return Location are required.');
        return;
    }
    if (!initialDiameter || !initialWeight || !initialGsm || !initialWidth) {
        setError('Could not retrieve full initial roll details. Please re-scan the roll.');
        return;
    }

    setMessage('');
    setError('');

    try {
        const coreDiameter = 10; // All diameters are in cm.
        const returnDiameter = parseFloat(diameter);
        const initialDia = parseFloat(initialDiameter);
        const initialWt = parseFloat(initialWeight);
        const gsm = parseFloat(initialGsm);
        const width = parseFloat(initialWidth);

        if (returnDiameter >= initialDia) {
            throw new Error('Return diameter must be smaller than the initial diameter.');
        }

        const numerator = (returnDiameter ** 2) - (coreDiameter ** 2);
        const denominator = (initialDia ** 2) - (coreDiameter ** 2);

        if (denominator <= 0) {
            throw new Error('Initial diameter is too small for calculation (must be > 10cm).');
        }

        const newWeightRaw = (numerator / denominator) * initialWt;
        //const consumedWeight = initialWt - newWeightRaw;

        const areaDensityKgM2 = gsm / 1000;
        const widthM = width / 100;
        if (areaDensityKgM2 <= 0 || widthM <= 0) {
            throw new Error('GSM and Width must be positive values to calculate length.');
        }
        
        const newLength = Math.ceil(newWeightRaw / (areaDensityKgM2 * widthM));
        const newWeight = parseFloat(newWeightRaw.toFixed(2));


        // 1. Record the return movement with correct column names
        const { error: movementError } = await supabase.from('pr_stock_movements').insert([
            {
                roll_id: rollId,
                plant: plant,
                movement_type: '202',
                initial_loc: bin_location,
                destination_loc: location,
                weight: newWeight,
                length: newLength,
                diameter: returnDiameter,
                batch: 'OLD',
                user_id: user.user_metadata.display_name || user.email,
            },
        ]);

        if (movementError) {
            throw new Error(`Failed to record return movement: ${movementError.message}`);
        }

        // 2. Update the stock record with new values
        const { error: updateError } = await supabase
            .from('pr_stock')
            .update({
                bin_location: location,
                weight: newWeight,
                diameter: returnDiameter,
                length: newLength,
                batch: 'OLD',
            })
            .eq('roll_id', rollId)
            .eq('plant', plant);

        if (updateError) {
            console.error("Attempting to rollback movement record...");
            throw new Error(`Failed to update stock details: ${updateError.message}. Manual correction might be needed.`);
        }

        setMessage(`Roll ${rollId} successfully returned to ${location}. New weight: ${newWeight}kg, New length: ${newLength}m.`);
        setTimeout(() => router.push(`/paper-roll/pr-issue?plant=${plant}`), 3000);

    } catch (error) {
        setError(error.message);
    }
  };

  return (
    <div>
      <h1>Return Paper Roll</h1>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleReturn}>
        <div className="form-group">
          <label htmlFor="rollId">Roll ID</label>
          <input
            id="rollId"
            type="text"
            className="form-control"
            value={rollId}
            onChange={(e) => setRollId(e.target.value)}
            onBlur={handleRollIdBlur}
            onKeyDown={handleKeyDown}
            readOnly={!!queryRollId}
            placeholder={queryRollId ? '' : 'Enter Roll ID and press Enter'}
          />
        </div>

        <div className="form-group">
          <label>Initial Weight (kg)</label>
          <input type="text" className="form-control" value={initialWeight} readOnly />
        </div>

        <div className="form-group">
          <label>Initial Diameter (cm)</label>
          <input type="text" className="form-control" value={initialDiameter} readOnly />
        </div>

        <hr />

        <div className="form-group">
          <label htmlFor="diameter">Return Diameter (cm)</label>
          <input
            id="diameter"
            type="number"
            className="form-control"
            value={diameter}
            onChange={(e) => setDiameter(e.target.value)}
            placeholder="Enter remaining diameter in cm"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="location">Return to Location</label>
          <input
            id="location"
            type="text"
            className="form-control"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Enter storage bin location"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary">
          Confirm Return
        </button>
        <button type="button" className="btn btn-secondary ml-2" onClick={() => router.back()}>
          Cancel
        </button>
      </form>
    </div>
  );
};

export default PRReturn;
