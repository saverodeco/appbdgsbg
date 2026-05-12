
import React, { useState } from 'react';
import { supabase } from '../../supabase/client'; // Import the Supabase client
import Papa from 'papaparse';

// Helper function to safely parse numbers
const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

// Updated helper function to safely parse dates in dd/mm/yyyy and dd.mm.yyyy format
const parseDate = (value) => {
  if (!value) return null;
  // Attempt to parse dd/mm/yyyy or dd.mm.yyyy
  const parts = value.split(/[\/.]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
      if (!isNaN(date.getTime())) {
        return date.toISOString(); // Return ISO string for Supabase
      }
    }
  }
  // Fallback for other date formats
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
};


export default function PrUploadStock({ plant }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage('');
    setErrorDetails([]); // Clear previous errors
  };

  const handleUpload = () => {
    if (!file) {
      setMessage('Please select a file to upload.');
      return;
    }

    if (!plant) {
        setMessage('No plant selected. Please select a plant before uploading.');
        return;
    }

    setUploading(true);
    setMessage('Processing file for synchronization...');
    setErrorDetails([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        console.log('CSV Headers:', results.meta.fields);
        let successCount = 0;
        let deleteCount = 0;
        const currentErrorDetails = [];

        // 1. Get all roll IDs from the CSV file for the current plant
        const csvRollIds = new Set(results.data.map(row => String(row.roll_id ?? '').trim()).filter(id => id));

        // 2. Find and delete rolls for the current plant not in the CSV
        setMessage('Removing old records for the selected plant...');
        const { data: dbRolls, error: fetchError } = await supabase
            .from('pr_stock')
            .select('roll_id')
            .eq('plant', plant);

        if (fetchError) {
          setMessage(`Error fetching existing rolls for plant ${plant}: ${fetchError.message}`);
          setUploading(false);
          return;
        }

        const rollsToDelete = dbRolls.filter(roll => !csvRollIds.has(roll.roll_id)).map(roll => roll.roll_id);
        if (rollsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('pr_stock')
            .delete()
            .in('roll_id', rollsToDelete)
            .eq('plant', plant);

          if (deleteError) {
            currentErrorDetails.push(`Failed to delete old records for plant ${plant}: ${deleteError.message}`);
          } else {
            deleteCount = rollsToDelete.length;
          }
        }

        // 3. Process updates and additions for the current plant
        setMessage('Updating and adding new records for the selected plant...');
        const upsertData = results.data.map((row, index) => {
            const csvRowNumber = index + 2;
            const rollId = String(row.roll_id ?? '').trim();

            if (!rollId) {
                currentErrorDetails.push(`Row ${csvRowNumber}: Missing or empty roll_id.`);
                return null; // Skip this row
            }
            
            const weight = parseNumber(row.weight);
            if (weight === null) {
                currentErrorDetails.push(`Row ${csvRowNumber} (Roll ${rollId}): Missing or invalid weight.`);
                return null; // Skip this row
            }
            
            return {
                roll_id: rollId,
                plant: plant,
                weight: weight,
                gsm: parseNumber(row.gsm),
                width: parseNumber(row.width),
                length: parseNumber(row.length),
                diameter: parseNumber(row.diameter),
                bin_location: row.bin_location ? String(row.bin_location).trim() : null,
                goods_receive_date: parseDate(row.goods_receive_date),
                kind: row.kind ? String(row.kind).trim() : null,
                batch: row.batch ? String(row.batch).trim() : null,
                updated_at: new Date().toISOString(),
            };
        }).filter(Boolean); // Filter out null entries from validation errors

        if (upsertData.length > 0) {
            const { error: upsertError } = await supabase.from('pr_stock').upsert(upsertData, { onConflict: 'roll_id,plant' });

            if (upsertError) {
                currentErrorDetails.push(`Error synchronizing data for plant ${plant}: ${upsertError.message}`);
            } else {
                successCount = upsertData.length;
            }
        }

        const errorCount = currentErrorDetails.length;
        let finalMessage = `Synchronization complete for plant ${plant}. ${successCount} rows processed, ${deleteCount} rolls deleted.`;
        if (errorCount > 0) {
            finalMessage += ` ${errorCount} rows failed.`;
        }
        setMessage(finalMessage);
        setErrorDetails(currentErrorDetails);

        setFile(null);
        setUploading(false);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        setMessage('Error parsing CSV file. Please check the file format and content.');
        setUploading(false);
      },
    });
  };

  return (
    <div>
      <h1>PR Upload Stock</h1>
      <p>Upload a CSV file to synchronize stock for the selected plant. This will add new rolls, update existing ones, and delete any rolls not present in the file for the current plant.</p>
      <input type="file" accept=".csv" onChange={handleFileChange} disabled={uploading} />
      <button onClick={handleUpload} disabled={uploading || !file}>
        {uploading ? 'Processing...' : 'Upload and Synchronize'}
      </button>
      {message && <p>{message}</p>}
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
    </div>
  );
}
