import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authUsers, setAuthUsers] = useState([]);

  // Fetch available accounts for dev switching
  const fetchAuthUsers = async () => {
    try {
      const res = await api.getAuthUsers();
      if (res.success) {
        setAuthUsers(res.data);
      }
    } catch {
      // Ignored if offline
    }
  };

  // Verify stored token on initial app load
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('bug_tracker_jwt');
      // Check stored JWT token
      if (token) {
        try {
          const res = await api.getMe();
          if (res.success) {
            setUser(res.data);
          } else {
            localStorage.removeItem('bug_tracker_jwt');
            setUser(null);
          }
        } catch {
          localStorage.removeItem('bug_tracker_jwt');
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
      fetchAuthUsers();
    };

    initAuth();
  }, []);

  // Login using received JWT (e.g. from OAuth redirect)
  const loginWithToken = async (token) => {
    localStorage.setItem('bug_tracker_jwt', token);
    try {
      const res = await api.getMe();
      if (res.success) {
        setUser(res.data);
        fetchAuthUsers();
        return res.data;
      }
    } catch (err) {
      localStorage.removeItem('bug_tracker_jwt');
      throw err;
    }
  };

  // 1-Click Fast Dev Login
  const devLogin = async (email, name) => {
    const res = await api.devLogin({ email, name });
    if (res.success) {
      localStorage.setItem('bug_tracker_jwt', res.token);
      setUser(res.user);
      fetchAuthUsers();
      return res.user;
    }
    throw new Error(res.message || 'Login failed');
  };

  // Logout session
  const logout = () => {
    localStorage.removeItem('bug_tracker_jwt');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authUsers,
        loginWithToken,
        devLogin,
        logout,
        refreshUser: () => api.getMe().then((r) => r.success && setUser(r.data)),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

