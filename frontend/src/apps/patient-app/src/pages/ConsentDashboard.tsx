import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';

interface Consent {
    id: string;
    granted_to: string;
    scopes: string[];
    purpose: string;
    expires_at: string;
    status: string;
    created_at: string;
    user_accounts?: {
        role: string;
    };
}

export const ConsentDashboard: React.FC = () => {
    const { user } = useAuth();
    const [consents, setConsents] = useState<Consent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchConsents();
    }, []);

    const fetchConsents = async () => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/consent/patient/${user?.linked_patient_id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${user?.access_token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch consents');
            }

            setConsents(data.consents);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (consentId: string) => {
        if (!confirm('Are you sure you want to revoke this access? The doctor will no longer be able to view your records.')) {
            return;
        }

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/consent/revoke/${consentId}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${user?.access_token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to revoke consent');
            }

            // Refresh consents
            fetchConsents();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const isExpired = (expiresAt: string) => {
        return new Date(expiresAt) < new Date();
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Access & Consent</h1>
            <p className="text-gray-600 mb-6">
                Manage who can access your medical records. You can revoke access at any time.
            </p>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {consents.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-gray-600">No active consents</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {consents.map((consent) => (
                        <div key={consent.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-1">
                                        {consent.user_accounts?.role === 'doctor' ? 'Doctor' : 'Healthcare Provider'}
                                    </h3>
                                    <p className="text-sm text-gray-600">{consent.purpose}</p>
                                </div>
                                <span className={`px-3 py-1 text-xs font-medium rounded-full ${consent.status === 'active' && !isExpired(consent.expires_at)
                                    ? 'bg-green-100 text-green-800'
                                    : consent.status === 'revoked'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {consent.status === 'active' && isExpired(consent.expires_at) ? 'Expired' : consent.status}
                                </span>
                            </div>

                            <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">Access Scopes:</p>
                                <div className="flex flex-wrap gap-2">
                                    {consent.scopes.map((scope, index) => (
                                        <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                                            {scope}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm text-gray-600">
                                <div>
                                    <p>Granted: {formatDate(consent.created_at)}</p>
                                    <p>Expires: {formatDate(consent.expires_at)}</p>
                                </div>

                                {consent.status === 'active' && !isExpired(consent.expires_at) && (
                                    <button
                                        onClick={() => handleRevoke(consent.id)}
                                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium"
                                    >
                                        Revoke Access
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
