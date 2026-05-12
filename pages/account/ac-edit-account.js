import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

const EditAccount = () => {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.user_metadata.display_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleDisplayNameChange = (e) => {
    setDisplayName(e.target.value);
  };

  const handleCurrentPasswordChange = (e) => {
    setCurrentPassword(e.target.value);
  };

  const handleNewPasswordChange = (e) => {
    setNewPassword(e.target.value);
  };

  const handleDisplayNameSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const { data, error: updateError } = await updateUser({ data: { display_name: displayName } });
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage('Successfully updated your display name.');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    // Supabase does not have a direct way to verify the current password before changing it.
    // The `updateUser` function with a new password will change it directly.
    const { data, error: passwordError } = await updateUser({ password: newPassword });
    if (passwordError) {
      setError(passwordError.message);
    } else {
      setMessage('Successfully updated your password.');
      setCurrentPassword('');
      setNewPassword('');
    }
  };

  return (
    <div>
      <h2>Edit Account</h2>
      <style jsx>{`
        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          max-width: 500px;
          margin: 0 auto;
        }
        .form-group {
          display: grid;
          grid-template-columns: 150px 1fr;
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
          grid-column: 1 / -1;
          justify-self: center;
          padding: 0.5rem 1rem;
          width: auto;
        }
        hr {
          border: 0;
          border-top: 1px solid #ccc;
          margin: 2rem 0;
        }
        .error {
          color: red;
          grid-column: 1 / -1;
          text-align: center;
        }
        .message {
          color: green;
          grid-column: 1 / -1;
          text-align: center;
        }
      `}</style>

      {error && <p className="error">{error}</p>}
      {message && <p className="message">{message}</p>}

      <form onSubmit={handleDisplayNameSubmit} className="form-grid">
        <h3>Edit Display Name</h3>
        <div className="form-group">
          <label htmlFor="displayName">Display Name</label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={handleDisplayNameChange}
          />
        </div>
        <button type="submit">Save Display Name</button>
      </form>

      <hr />

      <form onSubmit={handlePasswordSubmit} className="form-grid">
        <h3>Change Password</h3>
        <div className="form-group">
          <label htmlFor="newPassword">New Password</label>
          <input
            type="password"
            id="newPassword"
            value={newPassword}
            onChange={handleNewPasswordChange}
          />
        </div>
        <button type="submit">Save Password</button>
      </form>
    </div>
  );
};

export default EditAccount;
