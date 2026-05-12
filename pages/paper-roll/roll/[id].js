import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { formatDate } from '../../../utils/dateFormatter';

export default function RollDetails() {
  const router = useRouter();
  const { id, print } = router.query;

  useEffect(() => {
    if (print === 'true') {
      window.print();
      setTimeout(() => window.close(), 1000); // Close the window after printing
    }
  }, [print]);

  if (print === 'true') {
    return (
      <div style={{ textAlign: 'center', padding: '20px', border: '1px solid #000' }}>
        <h2>Roll ID: {id}</h2>
        {/* You can add a QR code component here if you have one */}
        {/* For example: <QRCode value={id} /> */}
        <p>Generated on: {formatDate(new Date())}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Roll Details: {id}</h1>
      {/* Display roll details here */}
    </div>
  );
}
