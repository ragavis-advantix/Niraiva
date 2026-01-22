import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import DoctorTopBar from '../components/DoctorTopBar';
import PatientCard from '../components/PatientCard';
import AddPatientModal from '../components/AddPatientModal';
import StatsCard from '../components/StatsCard';
import { Plus, Users, Activity, TrendingUp, Shield } from 'lucide-react';

interface Patient {
    user_id: string;
    name: string;  // Changed from full_name to match DB schema
    gender?: string;
    dob?: string;
    phone?: string;
    chronic_conditions?: string[];
    created_at?: string;
}

type FilterType = 'all' | 'chronic' | 'recent';

export default function DoctorDashboard() {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        setLoading(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setLoading(false);
            return;
        }

        // 1. Fetch domain doctor ID from doctors table
        const { data: doctor, error: doctorError } = await supabase
            .from('doctors')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

        if (doctorError || !doctor) {
            console.error('Doctor profile not found:', doctorError);
            setLoading(false);
            return;
        }

        const doctorId = doctor.id;
        console.log('Doctor ID resolved:', doctorId);

        // 2. Query doctor_patient_links -> patients (source of truth for patient data)
        const { data, error } = await supabase
            .from('doctor_patient_links')
            .select(`
                patient_id,
                patient:patients (
                    id,
                    name,
                    gender,
                    dob,
                    phone,
                    chronic_conditions,
                    created_at
                )
            `)
            .eq('doctor_id', doctorId);

        console.log('Fetched patients raw data:', { data, error });

        if (error) {
            console.error('Error fetching patients:', error);
            setLoading(false);
            return;
        }

        if (data) {
            // Extract patient objects from the nested structure
            const patientList = data
                .map((row: any) => {
                    if (!row.patient) return null;
                    const p = row.patient;
                    return {
                        user_id: p.id,
                        name: p.name || 'Unknown',
                        gender: p.gender,
                        dob: p.dob,
                        phone: p.phone,
                        chronic_conditions: p.chronic_conditions || [],
                        created_at: p.created_at
                    };
                })
                .filter((p: any) => p !== null);

            console.log('Mapped patients:', patientList);
            setPatients(patientList);
        }

        setLoading(false);
    };

    // Helper function to check if age matches search query
    const isAgeInRange = (dob: string | undefined, query: string): boolean => {
        if (!dob) return false;

        const birth = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        // Check for age range patterns
        // Pattern: "30-40" (range)
        if (query.includes('-')) {
            const [min, max] = query.split('-').map(n => parseInt(n.trim()));
            if (!isNaN(min) && !isNaN(max)) {
                return age >= min && age <= max;
            }
        }

        // Pattern: "40+" (40 and above)
        if (query.endsWith('+')) {
            const min = parseInt(query.replace('+', '').trim());
            if (!isNaN(min)) {
                return age >= min;
            }
        }

        // Pattern: "<25" (under 25)
        if (query.startsWith('<')) {
            const max = parseInt(query.replace('<', '').trim());
            if (!isNaN(max)) {
                return age < max;
            }
        }

        // Exact age match
        const exactAge = parseInt(query);
        if (!isNaN(exactAge)) {
            return age === exactAge;
        }

        return false;
    };

    // Calculate statistics
    const totalPatients = patients.length;
    const patientsWithConditions = patients.filter(p => p.chronic_conditions && p.chronic_conditions.length > 0).length;

    // Calculate median age (more clinically relevant than average)
    const medianAge = (() => {
        if (patients.length === 0) return null;
        const ages = patients
            .map(p => {
                if (!p.dob) return null;
                const birth = new Date(p.dob);
                const today = new Date();
                let age = today.getFullYear() - birth.getFullYear();
                const m = today.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                // Validate age range
                return (age >= 0 && age <= 120) ? age : null;
            })
            .filter((age): age is number => age !== null)
            .sort((a, b) => a - b);

        if (ages.length === 0) return null;
        const mid = Math.floor(ages.length / 2);
        return ages.length % 2 === 0 ? Math.round((ages[mid - 1] + ages[mid]) / 2) : ages[mid];
    })();

    // Filter by type
    const getFilteredByType = (filterType: FilterType) => {
        switch (filterType) {
            case 'chronic':
                return patients.filter(p => p.chronic_conditions && p.chronic_conditions.length > 0);
            case 'recent':
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return patients.filter(p => p.created_at && new Date(p.created_at) > thirtyDaysAgo);
            default:
                return patients;
        }
    };

    // Advanced multi-field search
    const filteredPatients = getFilteredByType(activeFilter).filter((p) => {
        const q = search.toLowerCase().trim();

        if (!q) return true; // Show all if search is empty

        // Search by name
        if (p.name?.toLowerCase().includes(q)) return true;

        // Search by phone
        if (p.phone?.includes(q)) return true;

        // Search by chronic conditions
        if (p.chronic_conditions?.some(c => c.toLowerCase().includes(q))) return true;

        // Search by age range
        if (isAgeInRange(p.dob, q)) return true;

        return false;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-white">
            <DoctorTopBar />

            <div className="max-w-6xl mx-auto px-6 py-6">

                {/* Greeting & Actions */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Your Patients
                        </h1>
                        <p className="text-gray-500 mt-1">
                            View and manage your clinical patient roster
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={() => navigate('/doctor/request-access')}
                            className="bg-white text-cyan-600 hover:bg-cyan-50 border border-cyan-200 shadow-sm"
                        >
                            <Shield className="w-4 h-4 mr-2" />
                            Request Access
                        </Button>
                        <Button
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-lg shadow-cyan-500/20"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add New Patient
                        </Button>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatsCard
                        title="Total Patients"
                        value={totalPatients}
                        icon={Users}
                        description="Currently under your care"
                    />
                    <StatsCard
                        title="Chronic Conditions"
                        value={patientsWithConditions}
                        icon={Activity}
                        description="Asthma, diabetes, hypertension…"
                    />
                    <StatsCard
                        title="Median Age"
                        value={medianAge !== null ? `${medianAge} yrs` : '--'}
                        icon={TrendingUp}
                        description="Risk profiling indicator"
                    />
                </div>

                {/* Search */}
                <div className="mb-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by name, phone, condition, or age"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onFocus={(e) => e.target.parentElement?.classList.add('focused')}
                            onBlur={(e) => e.target.parentElement?.classList.remove('focused')}
                            className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                        />
                        {search && (
                            <p className="text-xs text-gray-500 mt-2 px-1">
                                Searching across: name, phone, conditions, and age
                            </p>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 px-1">
                        💡 Tip: Try 'asthma', '40+', or phone digits
                    </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'all'
                            ? 'bg-cyan-500 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        All Patients ({patients.length})
                    </button>
                    <button
                        onClick={() => setActiveFilter('chronic')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'chronic'
                            ? 'bg-cyan-500 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        Chronic Conditions ({patientsWithConditions})
                    </button>
                    <button
                        onClick={() => setActiveFilter('recent')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'recent'
                            ? 'bg-cyan-500 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        Recently Added
                    </button>
                </div>

                {/* Patient List */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                        <p className="ml-3 text-gray-500">Loading patients...</p>
                    </div>
                ) : filteredPatients.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <div className="max-w-md mx-auto">
                            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600 text-lg font-medium mb-2">
                                {search ? 'No patients found matching your search' : 'No patients assigned yet'}
                            </p>
                            {!search && (
                                <>
                                    <p className="text-sm text-gray-400 mb-6">
                                        Patients will appear here once they are assigned to you
                                    </p>
                                    <Button
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-lg shadow-cyan-500/20"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Your First Patient
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredPatients.map((patient) => (
                            <PatientCard
                                key={patient.user_id}
                                patient={patient}
                                onOpen={() =>
                                    navigate(`/doctor/patient/${patient.user_id}`)
                                }
                            />
                        ))}
                    </div>
                )}
            </div>

            <AddPatientModal
                open={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={fetchPatients}
            />
        </div>
    );
}
