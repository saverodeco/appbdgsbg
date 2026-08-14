import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase/client';
import { useRouter } from 'next/router';

export default function EditAuthority() {
  const router = useRouter();
  const { id: userId } = router.query;
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // The master permission list (authorities) is safe to read directly —
        // its SELECT policy is open to all authenticated users, no RLS issue.
        const { data: authoritiesData, error: authoritiesError } = await supabase
          .from('authorities')
          .select('name, description');

        if (authoritiesError) throw authoritiesError;
        setAllPermissions(authoritiesData);

        // Fetching another user's profile goes through the Edge Function —
        // direct Supabase access is blocked by RLS (user_profiles SELECT is
        // limited to auth.uid() = id).
        const { data, error: fnError } = await supabase.functions.invoke(
          'manage-user-authority',
          { body: { action: 'get', userId } }
        );

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        setUser(data.user);
        setUserPermissions(data.user?.permissions || []);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const handlePermissionChange = (permissionName) => {
    setUserPermissions(prev =>
      prev.includes(permissionName)
        ? prev.filter(p => p !== permissionName)
        : [...prev, permissionName]
    );
  };

  const handleSave = async () => {
    if (!userId) return;
    setNotification('');
    setSaving(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'manage-user-authority',
        { body: { action: 'update', userId, permissions: userPermissions } }
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      router.push('/account/ac-authority-manager');
    } catch (err) {
      setNotification(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading user data...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!user) return <div>User not found.</div>;

  return (
    <div>
      <h2>Edit Authority for {user.email}</h2>
      {notification && <div className="alert alert-info">{notification}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Permission</th>
          </tr>
        </thead>
        <tbody>
          {allPermissions.map(permission => (
            <tr key={permission.name}>
              <td>{permission.name}</td>
              <td>{permission.description}</td>
              <td>
                <input
                  type="checkbox"
                  checked={userPermissions.includes(permission.name)}
                  onChange={() => handlePermissionChange(permission.name)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      <button onClick={() => router.push('/account/ac-authority-manager')} className="btn btn-secondary">
        Cancel
      </button>
    </div>
  );
}