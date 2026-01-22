
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Clock, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Toaster, toast } from 'sonner';

const RequestAccess = () => {
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [patient, setPatient] = useState<any>(null);
    const [step, setStep] = useState(1); // 1: Search, 2: Configure

    // Form State
    const [purpose, setPurpose] = useState('');
    const [duration, setDuration] = useState('24');
    const [scopes, setScopes] = useState<string[]>(['READ_REPORTS']);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/doctor/patient-lookup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ identifier })
            });
            const data = await res.json();

            if (res.ok) {
                setPatient(data);
                setStep(2);
            } else {
                toast.error(data.error || "Patient not found");
            }
        } catch (err) {
            toast.error("Network error");
        } finally {
            setLoading(false);
        }
    };

    const handleRequest = async () => {
        if (!purpose) {
            toast.error("Please specify a purpose");
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/consent/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patient_id: patient.patient_id,
                    purpose,
                    scopes,
                    duration_hours: parseInt(duration)
                })
            });
            const data = await res.json();

            if (res.ok) {
                toast.success("Request sent successfully!");
                navigate('/doctor/dashboard'); // Or back to list
            } else {
                toast.error(data.error || "Failed to send request");
            }
        } catch (err) {
            toast.error("Failed to send request");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <Toaster position="top-right" />
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-teal-600 text-white">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Shield className="w-5 h-5" /> Request Patient Access
                    </h2>
                    <p className="text-teal-100 text-sm mt-1">Get consent to view medical records</p>
                </div>

                <div className="p-8">
                    {/* STEP 1: SEARCH */}
                    {step === 1 && (
                        <form onSubmit={handleSearch} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Find Patient</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Enter Email, Phone ID or Patient ID"
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                                        value={identifier}
                                        onChange={e => setIdentifier(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Enter patient's registered email or verified phone number.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !identifier}
                                className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 transition disabled:opacity-50"
                            >
                                {loading ? 'Searching...' : 'Find Patient'}
                            </button>
                        </form>
                    )}

                    {/* STEP 2: CONFIGURE */}
                    {step === 2 && patient && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-800">{patient.display_name}</h3>
                                    <p className="text-sm text-gray-600">
                                        {patient.age !== 'N/A' ? `${patient.age} years` : ''} • {patient.gender || 'Unknown'}
                                    </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${patient.consent_status === 'GRANTED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                    {patient.consent_status === 'GRANTED' ? 'Active Access' : 'Consent Required'}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Purpose of Access <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. Consultation, Routine Checkup, Emergency"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                    value={purpose}
                                    onChange={e => setPurpose(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Data Scopes</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={scopes.includes('READ_REPORTS')}
                                            onChange={(e) => {
                                                if (e.target.checked) setScopes([...scopes, 'READ_REPORTS']);
                                                else setScopes(scopes.filter(s => s !== 'READ_REPORTS'));
                                            }}
                                            className="w-4 h-4 text-teal-600"
                                        />
                                        <div>
                                            <span className="font-medium text-gray-800">Health Reports</span>
                                            <p className="text-xs text-gray-500">Lab results, diagnostics, prescriptions</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={scopes.includes('READ_TIMELINE')}
                                            onChange={(e) => {
                                                if (e.target.checked) setScopes([...scopes, 'READ_TIMELINE']);
                                                else setScopes(scopes.filter(s => s !== 'READ_TIMELINE'));
                                            }}
                                            className="w-4 h-4 text-teal-600"
                                        />
                                        <div>
                                            <span className="font-medium text-gray-800">Medical Timeline</span>
                                            <p className="text-xs text-gray-500">History of visits and events</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: '24 Hours', val: '24' },
                                        { label: '7 Days', val: '168' },
                                        { label: '30 Days', val: '720' }
                                    ].map(opt => (
                                        <button
                                            key={opt.val}
                                            onClick={() => setDuration(opt.val)}
                                            className={`py-2 text-sm rounded-lg border transition ${duration === opt.val
                                                    ? 'bg-teal-600 text-white border-teal-600'
                                                    : 'text-gray-600 border-gray-200 hover:border-teal-300'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="w-1/3 py-3 rounded-lg border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRequest}
                                    disabled={loading || scopes.length === 0 || !purpose}
                                    className="w-2/3 bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 transition disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {loading ? 'Sending...' : 'Send Request'} <CheckCircle className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RequestAccess;
