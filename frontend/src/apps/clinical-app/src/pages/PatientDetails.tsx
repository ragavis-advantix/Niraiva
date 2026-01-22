import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    ChevronLeft, ShieldCheck, Mail, Phone, Calendar, User,
    Activity, ClipboardList, Clock, CheckCircle, AlertCircle,
    ArrowUpRight, ExternalLink, FileText, Pill
} from 'lucide-react';
import { toast } from 'sonner';

export const PatientDetails: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [patient, setPatient] = useState<any>(null);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPatientData();
    }, [patientId]);

    const fetchPatientData = async () => {
        setLoading(true);
        try {
            // Fetch patient details
            const pResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/clinical/patients/${patientId}`, {
                headers: { 'Authorization': `Bearer ${user?.access_token}` }
            });
            const pData = await pResponse.json();
            if (!pResponse.ok) throw new Error(pData.error);
            setPatient(pData.patient);

            // Fetch timeline (unified clinical + personal)
            const tResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/clinical/patients/${patientId}/timeline`, {
                headers: { 'Authorization': `Bearer ${user?.access_token}` }
            });
            const tData = await tResponse.json();
            if (tResponse.ok) setTimeline(tData.events || []);

        } catch (err: any) {
            toast.error(err.message || 'Failed to load clinical data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/clinical/registry')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Patient Details</h1>
                        <p className="text-[10px] text-blue-600 uppercase tracking-widest font-bold mt-0.5">Clinical Workspace</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        onClick={() => navigate(`/clinical/patient/${patientId}/invite`)}
                        variant="outline"
                        className="rounded-xl border-blue-100 text-blue-600 hover:bg-blue-50 font-bold uppercase tracking-widest text-[10px]"
                    >
                        Manage Access
                    </Button>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[10px]">Dual Timeline Protocol</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: ID & Status */}
                <div className="space-y-8">
                    {/* Identity Card */}
                    <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-gray-100 p-8">
                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-[2rem] flex items-center justify-center text-3xl font-bold shadow-lg shadow-blue-500/20 mb-4 transform -rotate-3 group-hover:rotate-0 transition-transform">
                                {patient?.full_name?.[0]}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">{patient?.full_name}</h2>
                            <div className="mt-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                                MRN: {patient?.mrn}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Age / Sex</span>
                                <span className="text-sm font-bold text-gray-700">{new Date().getFullYear() - new Date(patient?.dob).getFullYear()}Y / {patient?.sex || 'U'}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact</span>
                                <span className="text-sm font-bold text-gray-700">{patient?.phone}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Joined</span>
                                <span className="text-sm font-bold text-gray-700">{new Date(patient?.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Activation Status Card */}
                    <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-gray-100 p-8 overflow-hidden relative">
                        <div className="mb-6">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-1">Activation Status</h3>
                            <p className="text-xs text-gray-400">Patient portal linkage status</p>
                        </div>

                        <div className={`p-6 rounded-2xl flex items-center gap-4 border ${patient?.invite_status === 'activated' ? 'bg-green-50/50 border-green-100 text-green-700' :
                            patient?.invite_status === 'pending' ? 'bg-amber-50/50 border-amber-100 text-amber-700' :
                                'bg-gray-50 border-gray-100 text-gray-400'
                            }`}>
                            {patient?.invite_status === 'activated' ? <CheckCircle className="w-8 h-8" /> :
                                patient?.invite_status === 'pending' ? <Clock className="w-8 h-8" /> :
                                    <AlertCircle className="w-8 h-8" />}
                            <div>
                                <p className="text-sm font-bold uppercase tracking-widest">
                                    {patient?.invite_status === 'activated' ? 'Fully Active' :
                                        patient?.invite_status === 'pending' ? 'Awaiting Login' : 'Not Invited'}
                                </p>
                                <p className="text-[10px] opacity-70">
                                    {patient?.invite_status === 'activated' ? 'Patient is using the portal' :
                                        patient?.invite_status === 'pending' ? 'Invite link sent' : 'Account not linked'}
                                </p>
                            </div>
                        </div>

                        {patient?.invite_status !== 'activated' && (
                            <Button
                                onClick={() => navigate(`/clinical/patient/${patientId}/invite`)}
                                className="w-full mt-6 py-4 rounded-xl bg-gray-900 hover:bg-black text-white text-[10px] font-bold uppercase tracking-widest flex gap-2"
                            >
                                <ArrowUpRight className="w-4 h-4" />
                                {patient?.invite_status === 'pending' ? 'Resend Activation Link' : 'Start Activation Flow'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Right Column: Dual Timeline */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-gray-100 p-8 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Activity className="w-6 h-6 text-blue-600" />
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Unified Medical Timeline</h3>
                                    <p className="text-xs text-gray-400">Merged view of clinical and patient data</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase">
                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                    Doctor-reported
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-bold uppercase">
                                    <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                                    Patient-reported
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 space-y-6">
                            {timeline.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center py-24 text-center opacity-40">
                                    <ClipboardList className="w-16 h-16 mb-4 text-gray-200" />
                                    <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Intake empty. No events detected.</p>
                                </div>
                            ) : (
                                timeline.map((event, idx) => (
                                    <div key={idx} className="flex gap-6 group">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${event.authority === 'clinical' ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-purple-600 text-white shadow-purple-500/20'
                                                }`}>
                                                {event.event_type === 'medication' ? <Pill className="w-5 h-5" /> :
                                                    event.event_type === 'lab' ? <Activity className="w-5 h-5" /> :
                                                        <FileText className="w-5 h-5" />}
                                            </div>
                                            {idx < timeline.length - 1 && <div className="w-px flex-1 bg-gray-100 my-2"></div>}
                                        </div>
                                        <div className="flex-1 pb-8">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="font-bold text-gray-900">{event.event_type.toUpperCase()}</h4>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(event.event_time).toLocaleDateString()}</span>
                                            </div>
                                            <div className={`p-4 rounded-2xl border transition-colors ${event.authority === 'clinical' ? 'bg-blue-50/20 border-blue-100 group-hover:bg-blue-50/40' : 'bg-purple-50/20 border-purple-100 group-hover:bg-purple-50/40'
                                                }`}>
                                                <p className="text-sm text-gray-700 leading-relaxed">{event.metadata?.summary || 'New medical event recorded'}</p>
                                                {event.metadata?.source && (
                                                    <div className="mt-2 flex items-center gap-1.5">
                                                        <ExternalLink className="w-3 h-3 text-gray-400" />
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase">Source: {event.metadata.source}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
