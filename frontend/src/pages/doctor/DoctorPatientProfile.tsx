import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import DoctorTopBar from './components/DoctorTopBar';
import { Button } from '@/components/ui/button';
import {
    ChevronLeft,
    Pill,
    Thermometer,
    Heart,
    Calendar,
    Phone,
    User,
    ClipboardList,
    AlertCircle,
    Activity,
    FileText
} from 'lucide-react';
import { motion } from 'framer-motion';
import { HealthCard } from '@/components/HealthCard';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface PatientProfile {
    user_id: string;
    full_name: string;
    gender: string;
    dob: string;
    phone: string;
    chronic_conditions: string[];
}

interface Medication {
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    startDate?: string;
}

interface HealthParameter {
    id: string;
    parameterName: string; // Internal name for matching
    name: string; // Display name
    value: string | number;
    unit: string;
    status: 'normal' | 'warning' | 'critical';
    trend: 'up' | 'down' | 'stable';
    lastUpdated: string;
    timestamp: string; // Added for HealthCard compatibility
}

interface DoctorNote {
    id: string;
    note: string;
    created_at: string;
    doctor_id: string;
}

interface MedicalDocument {
    id: string;
    document_type: string;
    file_path: string;
    created_at: string;
    extracted_data?: any;
}

export default function DoctorPatientProfile() {
    const { patientUserId } = useParams<{ patientUserId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [patient, setPatient] = useState<PatientProfile | null>(null);
    const [medications, setMedications] = useState<Medication[]>([]);
    const [parameters, setParameters] = useState<HealthParameter[]>([]);
    const [notes, setNotes] = useState<DoctorNote[]>([]);
    const [reports, setReports] = useState<MedicalDocument[]>([]);
    const [newNote, setNewNote] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const calculateAge = (dob: string | null | undefined): number | null => {
        if (!dob) return null;
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    useEffect(() => {
        const fetchPatientData = async () => {
            if (!patientUserId) return;
            setLoading(true);

            try {
                // 1. Fetch Profile
                const { data: profileData, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('user_id', patientUserId)
                    .single();

                if (profileError) throw profileError;
                setPatient(profileData);

                // 2. Fetch Medications (Check if table exists, otherwise use empty)
                const { data: medData, error: medError } = await supabase
                    .from('medications')
                    .select('*')
                    .eq('user_id', patientUserId);

                if (!medError) setMedications(medData || []);

                // 3. Fetch Health Parameters
                const { data: paramData, error: paramError } = await supabase
                    .from('health_parameters')
                    .select('*')
                    .eq('user_id', patientUserId);

                if (!paramError) {
                    const mappedParams = (paramData || []).map(p => ({
                        ...p,
                        name: p.name || p.parameterName,
                        timestamp: p.timestamp || p.lastUpdated
                    }));
                    setParameters(mappedParams);
                }

                // 4. Fetch Notes
                const { data: notesData } = await supabase
                    .from('doctor_notes')
                    .select('*')
                    .eq('patient_user_id', patientUserId)
                    .order('created_at', { ascending: false });
                setNotes(notesData || []);

                // 5. Fetch Reports
                const { data: reportsData } = await supabase
                    .from('medical_documents')
                    .select('*')
                    .eq('patient_user_id', patientUserId)
                    .order('created_at', { ascending: false });
                setReports(reportsData || []);

            } catch (err: any) {
                console.error('Error fetching patient data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPatientData();
    }, [patientUserId]);

    const handleSaveNote = async () => {
        if (!newNote.trim() || !patientUserId) return;
        setIsSavingNote(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/doctor/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patientUserId,
                    note: newNote
                })
            });

            if (!response.ok) throw new Error("Failed to save note to clinical record");

            const savedNote = await response.json();
            setNotes([savedNote, ...notes]);
            setNewNote('');
            toast.success("Clinical note saved and added to timeline");
        } catch (err: any) {
            toast.error(err.message || "Failed to save note");
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !patientUserId) return;

        setIsUploading(true);
        toast.info("Uploading and processing report...");

        try {
            // 1. Upload to Storage
            const filePath = `patient_${patientUserId}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('medical-documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Call Backend for AI Processing
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/doctor/process-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({
                    patientUserId,
                    filePath,
                    documentType: 'lab_report' // Default for now
                })
            });

            if (!response.ok) throw new Error("AI processing failed");

            const result = await response.json();

            // 3. Refresh reports
            const { data: newReport } = await supabase
                .from('medical_documents')
                .select('*')
                .eq('file_path', filePath)
                .single();

            if (newReport) setReports([newReport, ...reports]);
            toast.success("Report processed successfully");

        } catch (err: any) {
            console.error("Upload error:", err);
            toast.error(err.message || "Upload failed");
        } finally {
            setIsUploading(false);
            // Reset input
            event.target.value = '';
        }
    };

    const viewOriginal = async (filePath: string) => {
        const { data, error } = await supabase.storage
            .from('medical-documents')
            .createSignedUrl(filePath, 60);
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
        if (error) toast.error("Could not fetch file");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (error || !patient) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900">Patient Not Found</h2>
                <p className="text-gray-600 mt-2">Could not retrieve the medical records for this patient.</p>
                <Button onClick={() => navigate('/doctor/dashboard')} className="mt-6 bg-cyan-500">
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <DoctorTopBar />

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/doctor/dashboard')}
                    className="flex items-center text-gray-600 hover:text-cyan-600 mb-6 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Back to Dashboard
                </button>

                {/* Profile Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="w-24 h-24 rounded-full bg-cyan-100 flex items-center justify-center text-3xl font-bold text-cyan-600 border-4 border-white shadow-sm">
                            {patient.full_name?.[0]}
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl font-bold text-gray-900">{patient.full_name}</h1>
                            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2 text-gray-600">
                                <span className="flex items-center gap-1">
                                    <User className="w-4 h-4" /> {patient.gender}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" /> {calculateAge(patient.dob)} yrs ({patient.dob})
                                </span>
                                <span className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" /> {patient.phone}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button className="bg-cyan-500 hover:bg-cyan-600">Edit Records</Button>
                            <div className="relative">
                                <Button
                                    variant="outline"
                                    className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                                    disabled={isUploading}
                                    onClick={() => document.getElementById('report-upload')?.click()}
                                >
                                    {isUploading ? "Processing..." : "Upload Report"}
                                </Button>
                                <input
                                    type="file"
                                    id="report-upload"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    accept=".pdf,image/*"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main History Column */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Health Parameters */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <Activity className="w-6 h-6 text-cyan-600" />
                                <h2 className="text-xl font-bold text-gray-900">Health Parameters</h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {parameters.length > 0 ? (
                                    parameters.map((param) => (
                                        <div key={param.id} className="h-40">
                                            <HealthCard parameter={param} />
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 bg-gray-100/50 border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500">
                                        No clinical vitals recorded yet.
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Medications */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <Pill className="w-6 h-6 text-cyan-600" />
                                <h2 className="text-xl font-bold text-gray-900">Active Medications</h2>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                {medications.length > 0 ? (
                                    <div className="divide-y divide-gray-100">
                                        {medications.map((med) => (
                                            <div key={med.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                                                <div className="p-2 bg-cyan-50 rounded-lg">
                                                    <Pill className="w-6 h-6 text-cyan-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-gray-900">{med.name}</h3>
                                                    <p className="text-sm text-gray-600">{med.dosage} · {med.frequency}</p>
                                                </div>
                                                <div className="text-sm text-gray-400">
                                                    Started {med.startDate || 'N/A'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-500 bg-gray-50">
                                        No active medications prescribed.
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Clinical Notes Section */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <ClipboardList className="w-6 h-6 text-cyan-600" />
                                <h2 className="text-xl font-bold text-gray-900">Clinical Observations</h2>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <div className="space-y-4">
                                    <Textarea
                                        placeholder="Add a clinical note or observation..."
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        className="min-h-[100px] border-gray-200 focus:ring-cyan-500"
                                    />
                                    <div className="flex justify-end">
                                        <Button
                                            onClick={handleSaveNote}
                                            disabled={isSavingNote || !newNote.trim()}
                                            className="bg-cyan-600 hover:bg-cyan-700"
                                        >
                                            {isSavingNote ? "Saving..." : "Save Note"}
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-8 space-y-4">
                                    {notes.length > 0 ? (
                                        notes.map((note) => (
                                            <div key={note.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex gap-3">
                                                <div className="mt-1">
                                                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                                                        <FileText className="w-4 h-4 text-gray-400" />
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                            Observation · {new Date(note.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                    <p className="text-gray-700 whitespace-pre-wrap">{note.note}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                                            No clinical notes yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Sidebar Column */}
                    <div className="space-y-8">
                        {/* Chronic Conditions */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <ClipboardList className="w-6 h-6 text-cyan-600" />
                                <h2 className="text-xl font-bold text-gray-900">Chronic Conditions</h2>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
                                {patient.chronic_conditions && patient.chronic_conditions.length > 0 ? (
                                    patient.chronic_conditions.map((condition, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-red-50 text-red-700 rounded-lg border border-red-100">
                                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                            <span className="font-medium">{condition}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-gray-500 py-4 italic">No chronic conditions listed.</p>
                                )}
                            </div>
                        </section>

                        {/* Recent Reports Placeholder */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-6 h-6 text-cyan-600" />
                                <h2 className="text-xl font-bold text-gray-900">Clinical Reports</h2>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 divide-y divide-gray-100">
                                {reports.length > 0 ? (
                                    reports.map((report) => (
                                        <div key={report.id} className="py-3 flex justify-between items-center group">
                                            <div className="cursor-pointer" onClick={() => viewOriginal(report.file_path)}>
                                                <p className="font-medium text-gray-900 group-hover:text-cyan-600 transition-colors">
                                                    {report.document_type === 'lab_report' ? 'Blood Analysis' :
                                                        report.document_type === 'prescription' ? 'Prescription' : 'Medical Report'}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(report.created_at).toLocaleDateString('en-IN')} · AI Parsed
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-cyan-600 h-8"
                                                onClick={() => viewOriginal(report.file_path)}
                                            >
                                                View
                                            </Button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-gray-500 py-4 italic">No reports uploaded yet.</p>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
