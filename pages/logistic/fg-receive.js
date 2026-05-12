import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../supabase/client';

const FGStock = ({ plant }) => {
  const { user } = useAuth();
  const [lmgNumber, setLmgNumber] = useState('');
  const [binLocation, setBinLocation] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!plant) {
      setError('No plant selected. Please select a plant before submitting.');
      setSubmitting(false);
      return;
    }

    const { error: submitError } = await supabase
      .from('fg_stock')
      .insert([
        {
          lmg_number: lmgNumber,
          bin_location: binLocation,
          user_id: user?.user_metadata?.display_name || user?.email,
          plant: plant,
        },
      ]);

    if (submitError) {
      setError(submitError.message || 'Failed to submit FG Stock data');
    } else {
      setMessage('FG Stock data submitted successfully');
      setLmgNumber('');
      setBinLocation('');
    }
    setSubmitting(false);
  };

  return (
    <div>
      <h2>FG Stock</h2>
      {message && <p className="message-success">{message}</p>}
      {error && <p className="message-error">{error}</p>}
      
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="form-group">
          <label htmlFor="binLocation">Bin Location</label>
          <input
            type="text"
            id="binLocation"
            value={binLocation}
            onChange={(e) => setBinLocation(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        <div className="form-group">
          <label htmlFor="lmgNumber">LMG Number</label>
          <input
            type="text"
            id="lmgNumber"
            value={lmgNumber}
            onChange={(e) => setLmgNumber(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

export default FGStock;
