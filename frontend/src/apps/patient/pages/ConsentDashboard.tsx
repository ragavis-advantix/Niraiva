
import React, { useEffect, useState } from 'react';
import { Shield, Check, X, Clock, AlertTriangle, FileText, Lock, Activity, Eye, History } from 'lucide-react';
import { Toaster, toast } from 'sonner';

interface ConsentRequest {
    id: string;
    doctor_id: string;
    purpose: string;
    scopes: string[];
    duration_hours: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    created_at: string;
    doctors: {
        id: string; // Doctor Internal ID
        user_profiles: {
            first_name: string;
            last_name: string;
        } | null; // might be null if structure is diff
    };
    // Correction: In backend controller, we fetch: doctors ( id, user_profiles ( first_name, last_name ) )
}

interface ActiveConsent {
    id: string;
    token_jti: string;
    expires_at: string;
    scopes: string[];
    doctors: {
        name: string;
        hospital?: string;
    };
}

interface AuditLog {
    id: string;
    action: string;
    details: any;
    timestamp: string;
    doctors?: {
        name: string;
        hospital?: string;
    };
    ip_address?: string;
}

export default function ConsentDashboard() {
    const [activeTab, setActiveTab] = useState<'requests' | 'active' | 'audit'>('requests');

    // Data States
    const [requests, setRequests] = useState<ConsentRequest[]>([]);
    const [activeConsents, setActiveConsents] = useState<ActiveConsent[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const apiUrl = import.meta.env.VITE_API_URL;

        try {
            if (activeTab === 'requests') {
                const res = await fetch(`${apiUrl}/api/consent/patient/requests`, { headers });
                const data = await res.json();
                if (res.ok) setRequests(data);
            } else if (activeTab === 'active') {
                const res = await fetch(`${apiUrl}/api/consent/patient/active-consents`, { headers });
                const data = await res.json();
                if (res.ok) setActiveConsents(data);
            } else if (activeTab === 'audit') {
                const res = await fetch(`${apiUrl}/api/audit/patient`, { headers });
                const data = await res.json();
                if (res.ok) setAuditLogs(data);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/consent/approve/${requestId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("Access Granted");
                fetchData(); // Refresh
            } else {
                toast.error("Approval failed");
            }
        } catch (err) {
            toast.error("Error approving request");
        }
    };

    const handleReject = async (requestId: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/consent/reject/${requestId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("Request Rejected");
                fetchData();
            }
        } catch (err) {
            toast.error("Error rejecting");
        }
    };

    const handleRevoke = async (tokenId: string) => {
        if (!confirm("Are you sure you want to revoke access? The doctor will lose access immediately.")) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/consent/revoke/${tokenId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("Access Revoked");
                fetchData();
            }
        } catch (err) {
            toast.error("Revocation failed");
        }
    };

    const formatDate = (iso: string) => new Date(iso).toLocaleString();

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <Toaster position="top-right" />
            <div className="mb-8">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                    <Shield className="text-teal-600" /> Consent Manager
                </h1>
                <p className="text-gray-500">Manage who can access your medical data</p>
            </div>

            {/* TABS */}
            <div className="flex gap-4 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`pb-3 px-4 font-medium flex items-center gap-2 ${activeTab === 'requests' ? 'border-b-2 border-teal-600 text-teal-600' : 'text-gray-500'}`}
                >
                    <AlertTriangle className="w-4 h-4" /> Pending Requests
                </button>
                <button
                    onClick={() => setActiveTab('active')}
                    className={`pb-3 px-4 font-medium flex items-center gap-2 ${activeTab === 'active' ? 'border-b-2 border-teal-600 text-teal-600' : 'text-gray-500'}`}
                >
                    <Lock className="w-4 h-4" /> Active Access
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={`pb-3 px-4 font-medium flex items-center gap-2 ${activeTab === 'audit' ? 'border-b-2 border-teal-600 text-teal-600' : 'text-gray-500'}`}
                >
                    <History className="w-4 h-4" /> Audit Log
                </button>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="py-12 text-center text-gray-500">Loading...</div>
            ) : (
                <div className="space-y-4">

                    {/* 1. REQUESTS TAB */}
                    {activeTab === 'requests' && (
                        requests.filter(r => r.status === 'PENDING').length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-lg text-gray-500">No pending requests</div>
                        ) :
                            requests.filter(r => r.status === 'PENDING').map(req => (
                                <div key={req.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-lg">
                                                Dr. {req.doctors?.user_profiles?.first_name || 'Generic'} {req.doctors?.user_profiles?.last_name || 'Doctor'}
                                            </h3>
                                            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded font-medium">Pending</span>
                                        </div>
                                        <p className="text-gray-600 mb-2">{req.purpose}</p>
                                        <div className="flex gap-3 text-sm text-gray-500">
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {req.duration_hours} Hours</span>
                                            <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {req.scopes.join(', ')}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 w-full md:w-auto">
                                        <button
                                            onClick={() => handleReject(req.id)}
                                            className="flex-1 md:flex-none py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApprove(req.id)}
                                            className="flex-1 md:flex-none py-2 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium shadow-sm"
                                        >
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            ))
                    )}

                    {/* 2. ACTIVE ACCESS TAB */}
                    {activeTab === 'active' && (
                        activeConsents.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-lg text-gray-500">No active consents</div>
                        ) :
                            activeConsents.map(token => (
                                <div key={token.id} className="bg-white border border-green-100 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex gap-4">
                                        <div className="bg-green-50 p-3 rounded-full h-fit">
                                            <Lock className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg text-gray-900">
                                                {token.doctors?.name || 'Dr. Unknown'}
                                            </h3>
                                            <p className="text-sm text-gray-500 mb-1">{token.doctors?.hospital || 'Hospital details unavailable'}</p>
                                            <div className="flex items-center gap-2 text-sm text-green-700">
                                                <Clock className="w-3 h-3" /> Expires: {formatDate(token.expires_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRevoke(token.id)}
                                        className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition"
                                    >
                                        Revoke Access
                                    </button>
                                </div>
                            ))
                    )}

                    {/* 3. AUDIT TAB */}
                    {activeTab === 'audit' && (
                        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Time</th>
                                        <th className="px-6 py-3 font-medium">Actor</th>
                                        <th className="px-6 py-3 font-medium">Action</th>
                                        <th className="px-6 py-3 font-medium">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {auditLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-3 text-gray-500">{formatDate(log.timestamp)}</td>
                                            <td className="px-6 py-3 font-medium text-gray-900">
                                                {log.doctors?.name || 'Self'}
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${log.action === 'APPROVE' ? 'bg-green-100 text-green-700' :
                                                        log.action === 'REVOKE' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-gray-500 max-w-xs truncate">
                                                {JSON.stringify(log.details)}
                                                {log.ip_address && <span className="text-gray-400 text-xs block mt-1">IP: {log.ip_address}</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {auditLogs.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-400">No logs found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
