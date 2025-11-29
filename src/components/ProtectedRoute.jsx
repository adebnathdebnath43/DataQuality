import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Force password change if temporary
    if (user.isTemporaryPassword && location.pathname !== '/change-password') {
        return <Navigate to="/change-password" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to dashboard if user doesn't have permission
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
