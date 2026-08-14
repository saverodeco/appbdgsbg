import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../supabase/client';

export default function AuthorityManager() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function fetchUsers() {
    setPageLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'manage-user-authority',
        { body: { action: 'list' } }
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching users:', err);
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (pageLoading) return <div>Loading users...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      <h1>Authority Manager</h1>

      <h2>User List</h2>
      <p>Select a user from the list below to edit their permissions.</p>
      <input
        type="text"
        placeholder="Search by user email..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ width: '100%', padding: '8px', marginBottom: '1rem', boxSizing: 'border-box' }}
      />

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Email</th>
            <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Permissions</th>
            <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length > 0 ? filteredUsers.map(user => (
            <tr key={user.id}>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{user.email}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                {(user.permissions || []).length > 0
                  ? user.permissions.join(', ')
                  : <em>Belum ada permission</em>}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                <button onClick={() => router.push(`/account/authority-manager/${user.id}`)}>
                  Edit Permissions
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan="3" style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}