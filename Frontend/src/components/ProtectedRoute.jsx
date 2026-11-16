import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070d19] flex items-center justify-center text-[#c7d1db]">
        <div className="flex items-center gap-3 bg-[#111c2e] border border-[#223554] px-6 py-4 rounded-xl shadow-lg">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Checking authentication...</span>
        </div>
      </div>
    );
  }

  // If not logged in, redirect to login page and preserve where the user was heading
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

