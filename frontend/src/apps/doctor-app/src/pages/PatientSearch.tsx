import React, { useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';

interface Patient {
    id: string;
    mrn: string;
    full_name: string;
    dob: string;
    phone?: string;
}

export const PatientSearch: React.FC = () => {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState<'name' | 'mrn' | 'phone'>('name');
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams();
            if (searchType === 'name') {
                params.append('q', searchQuery);
            } else if (searchType === 'mrn') {
                params.append('mrn', searchQuery);
            } else {
                params.append('phone', searchQuery);
            }

            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/patients/search?${params.toString()}`,
                {
                    headers: {
                        'Authorization': `Bearer ${user?.access_token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Search failed');
            }

            setPatients(data.patients);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Search Patients</h1>

            <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search Query
                        </label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search by ${searchType}...`}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search By
                        </label>
                        <select
                            value={searchType}
                            onChange={(e) => setSearchType(e.target.value as any)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="name">Name</option>
                            <option value="mrn">MRN</option>
                            <option value="phone">Phone</option>
                        </select>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {patients.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Results ({patients.length})</h2>
                    {patients.map((patient) => (
                        <div key={patient.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold text-gray-900">{patient.full_name}</h3>
                                    <p className="text-sm text-gray-600">MRN: {patient.mrn}</p>
                                    <p className="text-sm text-gray-600">DOB: {new Date(patient.dob).toLocaleDateString()}</p>
                                    {patient.phone && <p className="text-sm text-gray-600">Phone: {patient.phone}</p>}
                                </div>
                                <button
                                    onClick={() => window.location.href = `/doctor/patient/${patient.id}`}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                                >
                                    View Patient
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && patients.length === 0 && searchQuery && (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-gray-600">No patients found</p>
                </div>
            )}
        </div>
    );
};
