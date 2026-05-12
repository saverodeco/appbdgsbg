
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../supabase/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signup = async (email, password, display_name) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: display_name,
        },
      },
    });
  };

  const login = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const logout = async () => {
    return await supabase.auth.signOut();
  };

  const passwordReset = async (email) => {
    return await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://appbdgsbg-26846956-157ae.firebaseapp.com/' });
  };

  const updateUser = async (data) => {
    return await supabase.auth.updateUser(data);
  };

  const value = {
    user,
    loading,
    signup,
    login,
    logout,
    passwordReset,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}