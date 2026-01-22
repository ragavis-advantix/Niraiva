import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Send, Copy, Check, QrCode, ShieldCheck, Mail, Phone, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';

export const SendInvite: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [patient, setPatient] = useState<any>(null);
    const [inviteLink, setInviteLink] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchPatientAndInvite();
    }, [patientId]);

    const fetchPatientAndInvite = async () => {
        setLoading(true);
        try {
            // Fetch patient details
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/clinical/patients/${patientId}`, {
                headers: {
                    'Authorization': `Bearer ${user?.access_token}`
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setPatient(data.patient);

            // Fetch or create invite
            const inviteResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/patients/${patientId}/invite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user?.access_token}`
                }
            });
            const inviteData = await inviteResponse.json();
            if (inviteResponse.ok) {
                setInviteLink(inviteData.invite_link);
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to initialize invitation');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        toast.success('Activation link copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSendSms = async () => {
        setSending(true);
        try {
            // Mock SMS sending - in real app would hit an endpoint
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.success(`Invite sent to ${patient.phone}`);
        } catch (err: any) {
            toast.error('Failed to send SMS');
        } finally {
            setSending(false);
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
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Activate Access</h1>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-0.5">Secure Invitation System</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Clinical Auth Protocol</span>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Patient Context Card */}
                    <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 p-8">
                        <div className="flex items-center gap-6 mb-8">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold border-4 border-white shadow-lg shadow-blue-500/10">
                                {patient?.full_name?.[0]}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{patient?.full_name}</h2>
                                <p className="text-sm font-bold text-blue-600 tracking-widest uppercase">MRN: {patient?.mrn}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Phone className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mobile Number</p>
                                    <p className="font-semibold text-gray-700">{patient?.phone || 'Not provided'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Mail className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Address</p>
                                    <p className="font-semibold text-gray-700">{patient?.email || 'Not provided'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Calendar className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date of Birth</p>
                                    <p className="font-semibold text-gray-700">{patient?.dob}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 text-blue-800 text-sm">
                            <div className="flex gap-3">
                                <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p className="opacity-80 leading-relaxed">Identity is primary. Activation allows this patient to securely link an authentication account to their clinical record.</p>
                            </div>
                        </div>
                    </div>

                    {/* Invitation Actions */}
                    <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-blue-100 flex flex-col p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>

                        <div className="mb-8 relative">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Patient Invitation</h2>
                            <p className="text-gray-500 text-sm">Provide this link to the patient to enable their secure personal portal.</p>
                        </div>

                        <div className="flex-1 space-y-8">
                            {/* Copy Link Section */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Unique Activation Link</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-blue-800 font-mono break-all line-clamp-2">
                                        {inviteLink}
                                    </div>
                                    <button
                                        onClick={handleCopy}
                                        className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/30"
                                    >
                                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-1 gap-4">
                                <Button
                                    onClick={handleSendSms}
                                    disabled={sending || !patient?.phone}
                                    className="w-full py-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 active:scale-95 transition-all flex flex-col items-center gap-1"
                                >
                                    <div className="flex items-center gap-2">
                                        <Send className="w-4 h-4" />
                                        <span className="font-bold uppercase tracking-widest text-xs">Send via SMS</span>
                                    </div>
                                    <span className="text-[10px] opacity-70 font-medium">To {patient?.phone || 'No phone'}</span>
                                </Button>

                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        className="flex-1 py-8 rounded-2xl border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all flex flex-col items-center gap-1"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-gray-400" />
                                            <span className="font-bold uppercase tracking-widest text-xs">Email Link</span>
                                        </div>
                                        <span className="text-[10px] opacity-70 font-medium">patient@email.com</span>
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="flex-1 py-8 rounded-2xl border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all flex flex-col items-center gap-1"
                                    >
                                        <div className="flex items-center gap-2">
                                            <QrCode className="w-4 h-4 text-gray-400" />
                                            <span className="font-bold uppercase tracking-widest text-xs">Show QR Code</span>
                                        </div>
                                        <span className="text-[10px] opacity-70 font-medium">In-person activation</span>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-gray-100">
                            <Button
                                onClick={() => navigate('/clinical/registry')}
                                className="w-full py-4 rounded-xl text-gray-400 border-none hover:bg-gray-50 hover:text-gray-600 active:scale-95 transition-all font-bold uppercase tracking-widest text-[10px]"
                            >
                                Back to Registry
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
