import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const PostLoginGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [verifying, setVerifying] = useState(true);
    const [accessError, setAccessError] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate('/login');
            } else if (!user.linked_patient_id && user.role === 'patient') {
                setAccessError(true);
                setVerifying(false);
            } else {
                setVerifying(false);
            }
        }
    }, [user, loading, navigate]);

    if (loading || verifying) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-bold tracking-widest uppercase text-xs">Authenticating Privacy</p>
            </div>
        );
    }

    if (accessError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-4">Access Issue</h2>
                    <p className="text-gray-500 mb-8 font-medium">
                        This account is not linked to a patient record. To protect medical privacy, accounts must be activated via a clinical invite.
                    </p>
                    <div className="space-y-4">
                        <button
                            onClick={() => window.location.href = 'mailto:support@niraiva.com'}
                            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 transition"
                        >
                            Contact Your Hospital
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-black hover:bg-gray-200 transition"
                        >
                            Try Another Account
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
