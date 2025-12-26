import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import DoctorTopBar from './components/DoctorTopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    ChevronLeft,
    User,
    Briefcase,
    Activity,
    Settings,
    Shield,
    Lock,
    Clock,
    FileText,
    Users,
    ClipboardList,
    TrendingUp,
    Globe,
    Award,
    Calendar
} from 'lucide-react';

interface DoctorProfile {
    id: string;
    full_name: string;
    specialty?: string;
    registration_number?: string;
    council?: string;
    years_of_experience?: number;
    languages?: string[];
    email?: string;
    phone?: string;
    hospital?: string;
    created_at?: string;
}

interface ClinicalMetrics {
    totalPatients: number;
    chronicPatients: number;
    reportsReviewed: number;
    notesAdded: number;
}

interface RecentActivity {
    id: string;
    type: 'patient' | 'note' | 'report' | 'medication';
    description: string;
    timestamp: string;
}

export default function DoctorProfile() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<DoctorProfile | null>(null);
    const [metrics, setMetrics] = useState<ClinicalMetrics>({
        totalPatients: 0,
        chronicPatients: 0,
        reportsReviewed: 0,
        notesAdded: 0
    });
    const [activities, setActivities] = useState<RecentActivity[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({
        registration_number: '',
        council: '',
        specialty: '',
        years_of_experience: 0,
        languages: [] as string[],
        hospital: ''
    });

    useEffect(() => {
        fetchDoctorProfile();
    }, []);

    const fetchDoctorProfile = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch doctor profile
            const { data: doctorData, error: doctorError } = await supabase
                .from('doctors')
                .select('*')
                .eq('auth_user_id', user.id)
                .single();

            if (doctorError) throw doctorError;
            setProfile(doctorData);

            // Fetch clinical metrics
            const doctorId = doctorData.id;

            // Total patients
            const { count: totalCount } = await supabase
                .from('doctor_patient_links')
                .select('*', { count: 'exact', head: true })
                .eq('doctor_id', doctorId);

            // Patients with chronic conditions
            const { data: patientLinks } = await supabase
                .from('doctor_patient_links')
                .select('patient:patients(chronic_conditions)')
                .eq('doctor_id', doctorId);

            const chronicCount = patientLinks?.filter(
                (link: any) => link.patient?.chronic_conditions?.length > 0
            ).length || 0;

            // Reports reviewed (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { count: reportsCount } = await supabase
                .from('medical_documents')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', thirtyDaysAgo.toISOString());

            // Notes added (last 30 days)
            const { count: notesCount } = await supabase
                .from('doctor_notes')
                .select('*', { count: 'exact', head: true })
                .eq('doctor_id', doctorId)
                .gte('created_at', thirtyDaysAgo.toISOString());

            setMetrics({
                totalPatients: totalCount || 0,
                chronicPatients: chronicCount,
                reportsReviewed: reportsCount || 0,
                notesAdded: notesCount || 0
            });

        } catch (error) {
            console.error('Error fetching doctor profile:', error);
        } finally {
            setLoading(false);
        }
    };

    // Hydrate form when profile loads
    useEffect(() => {
        if (profile) {
            setForm({
                registration_number: profile.registration_number || '',
                council: profile.council || '',
                specialty: profile.specialty || '',
                years_of_experience: profile.years_of_experience || 0,
                languages: profile.languages || [],
                hospital: profile.hospital || ''
            });
        }
    }, [profile]);

    const saveProfile = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('doctors')
                .update({
                    registration_number: form.registration_number,
                    council: form.council,
                    specialty: form.specialty,
                    years_of_experience: form.years_of_experience,
                    languages: form.languages,
                    hospital: form.hospital
                })
                .eq('auth_user_id', user.id);

            if (error) throw error;

            toast.success('Profile updated successfully');
            setIsEditing(false);
            await fetchDoctorProfile();
        } catch (error) {
            console.error('Error saving profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/doctor/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">Profile not found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <DoctorTopBar />

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/doctor/dashboard')}
                    className="flex items-center text-gray-600 hover:text-cyan-600 mb-6 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Back to Dashboard
                </button>

                {/* Header Snapshot */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-cyan-100 flex items-center justify-center text-2xl font-bold text-cyan-600 border-4 border-white shadow-sm">
                            {profile.full_name?.[0]}
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-2xl font-bold text-gray-900 mb-1">{profile.full_name}</h1>
                            <div className="flex flex-wrap justify-center md:justify-start gap-3 text-gray-600 text-sm">
                                <span className="flex items-center gap-1">
                                    <Briefcase className="w-4 h-4" />
                                    {profile.specialty || 'General Practice'}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="flex items-center gap-1">
                                    <Award className="w-4 h-4" />
                                    {profile.years_of_experience || 0} years experience
                                </span>
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-2 text-gray-500 text-xs">
                                <span>Reg: {profile.registration_number || 'Not provided'}</span>
                                <span className="text-gray-400">•</span>
                                <span>{profile.hospital || 'Primary Hospital'}</span>
                                <span className="text-gray-400">•</span>
                                <span>{profile.email || profile.phone}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {isEditing ? (
                                <>
                                    <Button
                                        onClick={saveProfile}
                                        disabled={isSaving}
                                        className="bg-cyan-500 hover:bg-cyan-600"
                                    >
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsEditing(false);
                                            // Reset form to profile values
                                            if (profile) {
                                                setForm({
                                                    registration_number: profile.registration_number || '',
                                                    council: profile.council || '',
                                                    specialty: profile.specialty || '',
                                                    years_of_experience: profile.years_of_experience || 0,
                                                    languages: profile.languages || [],
                                                    hospital: profile.hospital || ''
                                                });
                                            }
                                        }}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        onClick={() => setIsEditing(true)}
                                        className="bg-cyan-500 hover:bg-cyan-600"
                                    >
                                        Edit Profile
                                    </Button>
                                    <Button variant="outline" className="border-cyan-200 text-cyan-700 hover:bg-cyan-50">
                                        Manage Availability
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Professional Information */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <User className="w-5 h-5 text-cyan-600" />
                                <h2 className="text-lg font-bold text-gray-900">Professional Details</h2>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Medical Registration</label>
                                        {isEditing ? (
                                            <Input
                                                value={form.registration_number}
                                                onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                                                className="mt-1"
                                                placeholder="Enter registration number"
                                            />
                                        ) : (
                                            <p className="text-gray-900 font-medium mt-1">{profile.registration_number || 'Not provided'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Council / Authority</label>
                                        {isEditing ? (
                                            <Input
                                                value={form.council}
                                                onChange={(e) => setForm({ ...form, council: e.target.value })}
                                                className="mt-1"
                                                placeholder="e.g., MCI, State Council"
                                            />
                                        ) : (
                                            <p className="text-gray-900 font-medium mt-1">{profile.council || 'Not specified'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Specialty</label>
                                        {isEditing ? (
                                            <Input
                                                value={form.specialty}
                                                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                                                className="mt-1"
                                                placeholder="e.g., Cardiology, General Practice"
                                            />
                                        ) : (
                                            <p className="text-gray-900 font-medium mt-1">{profile.specialty || 'General Practice'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Years of Experience</label>
                                        {isEditing ? (
                                            <Input
                                                type="number"
                                                value={form.years_of_experience}
                                                onChange={(e) => setForm({ ...form, years_of_experience: parseInt(e.target.value) || 0 })}
                                                className="mt-1"
                                                min="0"
                                            />
                                        ) : (
                                            <p className="text-gray-900 font-medium mt-1">{profile.years_of_experience || 0} years</p>
                                        )}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Languages Spoken</label>
                                        {isEditing ? (
                                            <Input
                                                value={form.languages.join(', ')}
                                                onChange={(e) => setForm({ ...form, languages: e.target.value.split(',').map(l => l.trim()) })}
                                                className="mt-1"
                                                placeholder="English, Hindi, Tamil (comma-separated)"
                                            />
                                        ) : (
                                            <p className="text-gray-900 font-medium mt-1">
                                                {profile.languages?.join(', ') || 'English, Hindi'}
                                            </p>
                                        )}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Hospital / Clinic</label>
                                        {isEditing ? (
                                            <Input
                                                value={form.hospital}
                                                onChange={(e) => setForm({ ...form, hospital: e.target.value })}
                                                className="mt-1"
                                                placeholder="Enter hospital or clinic name"
                                            />
                                        ) : (
                                            <p className="text-gray-900 font-medium mt-1">{profile.hospital || 'Not specified'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Clinical Overview */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <Activity className="w-5 h-5 text-cyan-600" />
                                <h2 className="text-lg font-bold text-gray-900">Clinical Overview</h2>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="w-4 h-4 text-cyan-600" />
                                        <span className="text-xs font-medium text-gray-500 uppercase">Active Patients</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{metrics.totalPatients}</p>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Activity className="w-4 h-4 text-orange-600" />
                                        <span className="text-xs font-medium text-gray-500 uppercase">Chronic Conditions</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{metrics.chronicPatients}</p>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="w-4 h-4 text-blue-600" />
                                        <span className="text-xs font-medium text-gray-500 uppercase">Reports (30d)</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{metrics.reportsReviewed}</p>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ClipboardList className="w-4 h-4 text-green-600" />
                                        <span className="text-xs font-medium text-gray-500 uppercase">Notes (30d)</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{metrics.notesAdded}</p>
                                </div>
                            </div>
                        </section>

                        {/* Practice Settings */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <Settings className="w-5 h-5 text-cyan-600" />
                                <h2 className="text-lg font-bold text-gray-900">Practice Settings</h2>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">Auto-attach name to notes</p>
                                        <p className="text-sm text-gray-500">Automatically add your name to clinical notes</p>
                                    </div>
                                    <div className="w-11 h-6 bg-cyan-500 rounded-full relative cursor-pointer">
                                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">Preferred units</p>
                                        <p className="text-sm text-gray-500">Metric (kg, cm) or Imperial (lbs, in)</p>
                                    </div>
                                    <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                                        <option>Metric</option>
                                        <option>Imperial</option>
                                    </select>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Sidebar Column */}
                    <div className="space-y-6">
                        {/* Access & Permissions */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <Shield className="w-5 h-5 text-cyan-600" />
                                <h2 className="text-lg font-bold text-gray-900">Access & Permissions</h2>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Role</label>
                                    <p className="text-gray-900 font-medium mt-1">Doctor</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Data Access Scope</label>
                                    <p className="text-gray-900 font-medium mt-1">Assigned Patients Only</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Write Permissions</label>
                                    <p className="text-gray-900 font-medium mt-1">Notes, Medications, Parameters</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Report Access</label>
                                    <p className="text-gray-900 font-medium mt-1">Read / Upload</p>
                                </div>
                            </div>
                        </section>

                        {/* Account & Security */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <Lock className="w-5 h-5 text-cyan-600" />
                                <h2 className="text-lg font-bold text-gray-900">Account & Security</h2>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Login Email</label>
                                    <p className="text-gray-900 font-medium mt-1">{profile.email || 'Not provided'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</label>
                                    <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="pt-2 space-y-2">
                                    <Button variant="outline" className="w-full text-sm">
                                        Change Password
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full text-sm text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={handleLogout}
                                    >
                                        Sign Out from All Devices
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
