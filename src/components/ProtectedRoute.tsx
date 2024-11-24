// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles = []
}) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    // Si hay roles permitidos y el usuario no tiene el rol adecuado
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // Redirigir a POS si no tiene acceso
        return <Navigate to="/pos" />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;