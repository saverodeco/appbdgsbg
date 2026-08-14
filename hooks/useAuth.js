import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext();
const API_BASE = '/api/auth'; // sesuaikan dengan URL backend Node.js kamu

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('token');
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    getSession();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) return { error: { message: data.message || 'Login gagal' } };
      localStorage.setItem('token', data.token);
      setUser(data.user);
      return { error: null };
    } catch (err) {
      return { error: { message: 'Tidak bisa terhubung ke server' } };
    }
  };

  const logout = async () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const passwordReset = async (email) => {
    try {
      const res = await fetch(`${API_BASE}/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) return { error: { message: data.message } };
      return { error: null };
    } catch (err) {
      return { error: { message: 'Tidak bisa terhubung ke server' } };
    }
  };

  const value = { user, loading, login, logout, passwordReset };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}