import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, ShieldCheck, Filter, MoreHorizontal, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Patient {
    id: string;
    mrn: string;
    full_name: string;
    dob: string;
    phone: string;
    invite_status: 'activated' | 'pending' | 'none';
    created_at: string;
}

export const PatientRegistry: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'activated' | 'pending'>('all');

    useEffect(() => {
        fetchRegistry();
    }, []);

    const fetchRegistry = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/clinical/patients`, {
                headers: {
                    'Authorization': `Bearer ${user?.access_token}`
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setPatients(data.patients || []);
        } catch (err: any) {
            toast.error(err.message || 'Failed to load patient registry');
        } finally {
            setLoading(false);
        }
    };

    const filteredPatients = patients.filter(p => {
        const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.mrn.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.phone?.includes(searchTerm);

        if (filter === 'all') return matchesSearch;
        return matchesSearch && p.invite_status === filter;
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'activated': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
            default: return <AlertCircle className="w-4 h-4 text-gray-300" />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'activated': return 'Activated';
            case 'pending': return 'Invite Sent';
            default: return 'No Invite';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Patient Registry</h1>
                    <p className="text-xs text-gray-500 uppercase tracking-[0.2em] font-bold mt-1">Clinical Information System</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Active Clinical Session</span>
                    </div>
                    <Button
                        onClick={() => navigate('/clinical/patient/create')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-6 rounded-2xl shadow-lg shadow-blue-500/30 font-bold uppercase tracking-widest text-xs flex gap-2"
                    >
                        <UserPlus className="w-4 h-4" />
                        New Patient Record
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search by MRN, Name, or Phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 transition-all outline-none text-sm font-medium"
                        />
                    </div>
                    <div className="flex bg-white border border-gray-200 p-1 rounded-2xl">
                        {(['all', 'activated', 'pending'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${filter === f ? 'bg-gray-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-blue-900/5 overflow-hidden">
                    {loading ? (
                        <div className="py-24 flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Synchronizing clinical data...</p>
                        </div>
                    ) : filteredPatients.length === 0 ? (
                        <div className="py-24 text-center">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Search className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No patients found</h3>
                            <p className="text-gray-400 text-sm mb-8">Try adjusting your search or filters to find what you're looking for.</p>
                            <Button
                                variant="outline"
                                onClick={() => { setSearchTerm(''); setFilter('all'); }}
                                className="rounded-xl px-8"
                            >
                                Clear All
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Medical Identity</th>
                                        <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Activation Status</th>
                                        <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact Info</th>
                                        <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredPatients.map((patient) => (
                                        <tr
                                            key={patient.id}
                                            onClick={() => navigate(`/clinical/patient/${patient.id}`)}
                                            className="group hover:bg-blue-50/30 transition-colors cursor-pointer"
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-gray-100 group-hover:bg-blue-100 text-gray-500 group-hover:text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg transition-colors border-2 border-white shadow-sm">
                                                        {patient.full_name[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 mb-0.5">{patient.full_name}</div>
                                                        <div className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">MRN: {patient.mrn}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1 rounded-full ${patient.invite_status === 'activated' ? 'bg-green-100' :
                                                        patient.invite_status === 'pending' ? 'bg-amber-100' : 'bg-gray-100'
                                                        }`}>
                                                        {getStatusIcon(patient.invite_status)}
                                                    </div>
                                                    <span className={`text-xs font-bold uppercase tracking-wider ${patient.invite_status === 'activated' ? 'text-green-600' :
                                                        patient.invite_status === 'pending' ? 'text-amber-600' : 'text-gray-400'
                                                        }`}>
                                                        {getStatusText(patient.invite_status)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="space-y-1">
                                                    <div className="text-xs font-semibold text-gray-600">{patient.phone}</div>
                                                    <div className="text-[10px] text-gray-400">{new Date(patient.dob).toLocaleDateString()}</div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <Button
                                                    variant="ghost"
                                                    className="p-2 hover:bg-white rounded-lg text-gray-400 group-hover:text-blue-600 transition-colors shadow-none"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/clinical/patient/${patient.id}/invite`);
                                                    }}
                                                >
                                                    <MoreHorizontal className="w-5 h-5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-between items-center px-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Total Records: {filteredPatients.length}</p>
                    <div className="flex gap-2">
                        <Button variant="outline" className="text-xs h-9 px-4 rounded-xl border-gray-200" disabled>Previous</Button>
                        <Button variant="outline" className="text-xs h-9 px-4 rounded-xl border-gray-200" disabled>Next</Button>
                    </div>
                </div>
            </main>
        </div>
    );
};
