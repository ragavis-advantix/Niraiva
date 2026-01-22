import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Activity, Clock, FileText, Upload, ShieldCheck,
    ArrowRight, Heart, Calendar, ArrowUpRight, Plus,
    Pill
} from 'lucide-react';

interface QuickStat {
    label: string;
    value: string;
    unit: string;
    trend?: 'up' | 'down' | 'stable';
    type: 'clinical' | 'personal';
}

export const PatientHome: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [recentEvents, setRecentEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        if (!user?.linked_patient_id) return;
        setLoading(true);
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/timeline/patient/${user.linked_patient_id}?limit=3`,
                {
                    headers: { 'Authorization': `Bearer ${user.access_token}` }
                }
            );
            const data = await response.json();
            if (response.ok) setRecentEvents(data.events || []);
        } catch (err) {
            console.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const stats: QuickStat[] = [
        { label: 'Heart Rate', value: '72', unit: 'bpm', trend: 'stable', type: 'clinical' },
        { label: 'Blood Glucose', value: '98', unit: 'mg/dL', type: 'personal' },
        { label: 'Sleep Quality', value: '84', unit: '%', trend: 'up', type: 'personal' }
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
            {/* Soft Header */}
            <header className="bg-white/70 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-[0.2em]">Niraiva Portal</span>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Secured Patient Session</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-xs font-bold text-gray-900">{user?.email}</span>
                        <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Identity Verified</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center text-sm font-bold text-gray-500">
                        {user?.email?.[0].toUpperCase()}
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full space-y-8">
                {/* Hero Section */}
                <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-gray-900 to-blue-900 p-8 md:p-12 text-white shadow-2xl shadow-blue-900/20">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    <div className="relative z-10">
                        <h1 className="text-3xl md:text-4xl font-bold mb-2">Welcome Home, Identity.</h1>
                        <p className="text-blue-100/70 text-sm md:text-base max-w-lg leading-relaxed">
                            Your clinical data and personal health records are unified here under private, secured clinical protocols.
                        </p>

                        <div className="flex flex-wrap gap-4 mt-8">
                            <Button
                                onClick={() => navigate('/patient/timeline')}
                                className="bg-white text-blue-900 hover:bg-blue-50 px-8 py-6 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-white/10 active:scale-95 transition-all flex gap-2"
                            >
                                <Clock className="w-4 h-4" />
                                View Timeline
                            </Button>
                            <Button
                                onClick={() => navigate('/patient/personal-records')}
                                className="bg-blue-500/20 hover:bg-blue-500/30 text-white border border-white/10 px-8 py-6 rounded-2xl font-bold uppercase tracking-widest text-xs backdrop-blur-sm active:scale-95 transition-all flex gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add Personal Record
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Vitals Summary */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Latest Vitals</h2>
                            <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">Real-time Sync</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {stats.map((stat, idx) => (
                                <div key={idx} className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-xl shadow-blue-900/5 group hover:border-blue-200 transition-all cursor-default">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-2 rounded-xl ${stat.type === 'clinical' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                            {stat.label.includes('Heart') ? <Heart className="w-4 h-4" /> :
                                                stat.label.includes('Glucose') ? <Activity className="w-4 h-4" /> :
                                                    <Calendar className="w-4 h-4" />}
                                        </div>
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${stat.type === 'clinical' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                            }`}>
                                            {stat.type === 'clinical' ? 'Clinical' : 'Personal'}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black text-gray-900">{stat.value}</span>
                                        <span className="text-xs font-bold text-gray-400 uppercase">{stat.unit}</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Recent Activity Mini-Feed */}
                        <div className="space-y-6 pt-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Recent Activity</h2>
                                <button
                                    onClick={() => navigate('/patient/timeline')}
                                    className="text-[10px] text-gray-400 hover:text-blue-600 font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"
                                >
                                    Full History <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>

                            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-blue-900/5 overflow-hidden">
                                {loading ? (
                                    <div className="py-12 flex flex-col items-center gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Synchronizing health events...</p>
                                    </div>
                                ) : recentEvents.length === 0 ? (
                                    <div className="py-12 text-center opacity-40">
                                        <FileText className="w-12 h-12 mb-3 text-gray-300 mx-auto" />
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No recent activity detected.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {recentEvents.map((event, idx) => (
                                            <div key={idx} className="p-6 flex items-center gap-6 hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => navigate('/patient/timeline')}>
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${event.authority === 'clinical' ? 'bg-blue-600/10 text-blue-600 border border-blue-100' : 'bg-purple-600/10 text-purple-600 border border-purple-100'
                                                    }`}>
                                                    {event.event_type === 'medication' ? <Pill className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <h4 className="font-bold text-gray-900 text-sm truncate uppercase tracking-tight">{event.metadata?.summary || event.event_type}</h4>
                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${event.authority === 'clinical' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                            }`}>
                                                            {event.authority === 'clinical' ? 'Doctor-reported' : 'You added'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(event.event_time).toLocaleDateString()}</p>
                                                </div>
                                                <ArrowUpRight className="w-4 h-4 text-gray-200 group-hover:text-blue-600 transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Actions */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Management</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <button
                                onClick={() => navigate('/patient/consent')}
                                className="group bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-blue-900/5 hover:border-blue-200 transition-all text-left active:scale-95"
                            >
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-gray-900 text-sm mb-1 uppercase tracking-tight">Privacy & Consent</h3>
                                <p className="text-[10px] text-gray-400 font-medium leading-relaxed">Manage which doctors can access your clinical and personal records.</p>
                            </button>

                            <button
                                onClick={() => navigate('/patient/personal-records')}
                                className="group bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-blue-900/5 hover:border-indigo-200 transition-all text-left active:scale-95"
                            >
                                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-gray-900 text-sm mb-1 uppercase tracking-tight">Health Uploads</h3>
                                <p className="text-[10px] text-gray-400 font-medium leading-relaxed">Contribute to your history by uploading symptoms or lifestyle notes.</p>
                            </button>
                        </div>

                        {/* Support Card */}
                        <div className="bg-blue-600 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                            <h3 className="text-lg font-bold mb-2">Need Clinical Support?</h3>
                            <p className="text-blue-100 text-[10px] font-medium leading-relaxed mb-6 opacity-80">
                                If you notice discrepancies in your doctor-reported data, please contact your primary care provider.
                            </p>
                            <Button className="w-full bg-white text-blue-600 hover:bg-blue-50 rounded-xl font-black uppercase tracking-[0.2em] text-[9px] py-4 h-auto shadow-lg shadow-white/5">
                                Contact Provider
                            </Button>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="p-8 border-t border-gray-100 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em]">Niraiva Health Identity Protocol v1.0</p>
                <p className="text-[8px] text-gray-300 font-bold uppercase tracking-widest mt-2">End-to-End Clinical Encryption Enabled</p>
            </footer>
        </div>
    );
};
