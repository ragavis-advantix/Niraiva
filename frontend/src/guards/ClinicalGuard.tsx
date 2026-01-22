import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ClinicalGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-cyan-600"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/doctor/login" state={{ from: location }} replace />;
    }

    const clinicalRoles = ['doctor', 'clinic', 'clinical_staff', 'admin'];
    if (!clinicalRoles.includes(user.role || '')) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
