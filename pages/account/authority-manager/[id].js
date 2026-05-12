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
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all available permissions from the authorities table
        const { data: authoritiesData, error: authoritiesError } = await supabase
          .from('authorities')
          .select('name, description');

        if (authoritiesError) throw authoritiesError;
        setAllPermissions(authoritiesData);

        // Fetch user data
        const { data: userData, error: userError } = await supabase
          .from('user_profiles')
          .select('id, email, permissions')
          .eq('id', userId)
          .single();

        if (userError) throw userError;
        setUser(userData);
        
        // Set the initial state of the permissions
        if (userData?.permissions) {
          setUserPermissions(userData.permissions);
        }

      } catch (err) {
        setError(err.message);
        console.error("Error fetching data:", err);
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

    const { data, error: updateError } = await supabase
      .from('user_profiles')
      .update({ permissions: userPermissions, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select(); // IMPORTANT: Return the updated data
    
    if (updateError) {
      setNotification(`Error: ${updateError.message}`);
    } else if (!data || data.length === 0) {
      // This is the crucial check for RLS issues
      setNotification('Error: Update failed. This is likely a permission issue. Please check that your Row Level Security policies allow admins to update the user_profiles table.');
    } else {
      // On successful save, navigate back to the user list
      router.push('/account/ac-authority-manager');
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

      <button onClick={handleSave} className="btn btn-primary">Save Changes</button>
      <button onClick={() => router.push('/account/ac-authority-manager')} className="btn btn-secondary">Cancel</button>
    </div>
  );
}
