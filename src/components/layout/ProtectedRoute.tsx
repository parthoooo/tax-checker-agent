import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  roles?: UserRole[];
}

const ProtectedRoute: React.FC<Props> = ({ children, roles }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) {
    if (user.role === 'admin' || user.role === 'preparer') return <Navigate to="/dashboard" replace />;
    return <Navigate to="/portal" replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
