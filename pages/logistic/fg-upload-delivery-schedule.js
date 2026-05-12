import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../supabase/client';
import Papa from 'papaparse';

const UploadDeliverySchedule = ({ plant }) => {
  const { user } = useAuth();
  const [scheduleDate, setScheduleDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setMessage('');
    setError(null);
    setErrorDetails([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setErrorDetails([]);
    setSubmitting(true);

    if (!plant) {
      setError('No plant selected. Please select a plant before submitting.');
      setSubmitting(false);
      return;
    }

    if (!selectedFile) {
      setError('Please select a file to upload.');
      setSubmitting(false);
      return;
    }

    if (!scheduleDate) {
      setError('Please select a schedule date.');
      setSubmitting(false);
      return;
    }

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const currentErrorDetails = [];
        const dataToInsert = results.data.map((row, index) => {
          const csvRowNumber = index + 2;
          const soNumber = row['SO Number'] ? String(row['SO Number']).trim() : null;
          const soItem = row['SO Item'] ? String(row['SO Item']).trim() : null;

          if (!soNumber) {
            currentErrorDetails.push(`Row ${csvRowNumber}: Missing or empty SO Number.`);
            return null;
          }
          if (!soItem) {
            currentErrorDetails.push(`Row ${csvRowNumber} (SO Number: ${soNumber}): Missing or empty SO Item.`);
            return null;
          }
          
          return {
            so_number: soNumber,
            so_item: soItem,
            customer_name: row['Customer Name'],
            print_design: row['Print Design'],
            weight_pcs: row['Weight Pcs'],
            outstanding_qty: row['Outstanding Qty'],
            schedule_date: scheduleDate,
            schedule_number: row['Schedule Number'],
            truck_type: row['Truck Type'],
            plant: plant,
            user_name: user?.email,
            delivery_status: 'Scheduled',
          };
        }).filter(Boolean);

        if (currentErrorDetails.length > 0) {
          setError(`Found ${currentErrorDetails.length} errors in the CSV file. Please fix them and try again.`);
          setErrorDetails(currentErrorDetails);
        } else if (dataToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('fg_delivery_schedule')
            .insert(dataToInsert);

          if (insertError) {
            setError(insertError.message || 'Failed to submit delivery schedule data');
          } else {
            setMessage('Delivery schedule submitted successfully');
            setScheduleDate('');
            setSelectedFile(null);
            document.getElementById('scheduleFile').value = '';
          }
        } else {
            setError('No valid data found in the CSV file to upload.');
        }

        setSubmitting(false);
      },
      error: (err) => {
        setError(err.message || 'Failed to parse CSV file.');
        setSubmitting(false);
      }
    });
  };

  return (
    <div>
      <h2>Upload Delivery Schedule</h2>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {errorDetails.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Error Details:</h3>
          <ul style={{ color: 'red', maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
            {errorDetails.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      <style jsx>{`
        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        .form-group {
          display: grid;
          grid-template-columns: 120px 1fr;
          align-items: center;
          gap: 1rem;
        }
        label {
          text-align: right;
        }
        input {
          width: 100%;
          padding: 0.5rem;
          box-sizing: border-box;
        }
        button {
          grid-column: 1 / -1; /* Span across all columns */
          justify-self: center;
          padding: 0.5rem 1rem;
        }
        @media (min-width: 600px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="form-group">
          <label htmlFor="scheduleDate">Schedule Date</label>
          <input
            type="date"
            id="scheduleDate"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        <div className="form-group">
          <label htmlFor="scheduleFile">Schedule File (CSV)</label>
          <input
            type="file"
            id="scheduleFile"
            accept=".csv"
            onChange={handleFileChange}
            required
            disabled={submitting}
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Uploading...' : 'Upload Schedule'}
        </button>
      </form>
    </div>
  );
};

export default UploadDeliverySchedule;
