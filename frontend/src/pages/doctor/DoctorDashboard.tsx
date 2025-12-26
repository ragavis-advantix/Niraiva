import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import DoctorTopBar from './components/DoctorTopBar';
import PatientCard from './components/PatientCard';
import AddPatientModal from './components/AddPatientModal';
import { Plus } from 'lucide-react';

interface Patient {
    user_id: string;
    full_name: string;
    gender?: string;
    dob?: string;
    phone?: string;
    chronic_conditions?: string[];
    created_at?: string;
}

export default function DoctorDashboard() {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

        // Query doctor_patients junction table with patient details from user_profiles
        const { data, error } = await supabase
            .from('doctor_patients')
            .select(`
                patient_user_id,
                user_profiles!inner (
                    user_id,
                    full_name,
                    gender,
                    dob,
                    phone,
                    chronic_conditions,
                    created_at
                )
            `)
            .eq('doctor_id', user.id);

        console.log('Fetched patients:', { data, error });

        if (!error && data) {
            // Extract patient objects from the nested structure
            const patientList = data
                .map((d: any) => d.user_profiles)
                .filter((p: any) => p !== null);
            setPatients(patientList);
        } else if (error) {
            console.error('Error fetching patients:', error);
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

    // Advanced multi-field search
    const filteredPatients = patients.filter((p) => {
        const q = search.toLowerCase().trim();

        if (!q) return true; // Show all if search is empty

        // Search by name
        if (p.full_name?.toLowerCase().includes(q)) return true;

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
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Your Patients
                        </h1>
                        <p className="text-gray-500 mt-1">
                            View and manage your clinical patient roster
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-lg shadow-cyan-500/20"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Patient
                    </Button>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <input
                        type="text"
                        placeholder="Search by name, phone, condition, or age (e.g., '30-40', '40+', 'diabetes')"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                    />
                    {search && (
                        <p className="text-xs text-gray-500 mt-2 px-1">
                            Searching across: name, phone, conditions, and age
                        </p>
                    )}
                </div>

                {/* Patient List */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                        <p className="ml-3 text-gray-500">Loading patients...</p>
                    </div>
                ) : filteredPatients.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                        <p className="text-gray-500">
                            {search ? 'No patients found matching your search' : 'No patients assigned yet'}
                        </p>
                        {!search && (
                            <p className="text-sm text-gray-400 mt-2">
                                Patients will appear here once they are assigned to you
                            </p>
                        )}
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
