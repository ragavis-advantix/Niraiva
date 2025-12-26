import React from 'react';

function calculateAge(dob: string) {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

interface PatientCardProps {
    patient: {
        user_id: string;
        full_name: string;
        gender?: string;
        dob?: string;
        phone?: string;
        chronic_conditions?: string[];
    };
    onOpen: () => void;
}

export default function PatientCard({ patient, onOpen }: PatientCardProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
            <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                    {patient.full_name}
                </h3>
                <p className="text-sm text-gray-600">
                    {patient.gender || 'N/A'} · {patient.dob ? calculateAge(patient.dob) : '--'} yrs
                </p>
                {patient.phone && (
                    <p className="text-xs text-gray-500">
                        {patient.phone}
                    </p>
                )}
                {patient.chronic_conditions && patient.chronic_conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {patient.chronic_conditions.slice(0, 2).map((condition, idx) => (
                            <span
                                key={idx}
                                className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full"
                            >
                                {condition}
                            </span>
                        ))}
                        {patient.chronic_conditions.length > 2 && (
                            <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                +{patient.chronic_conditions.length - 2} more
                            </span>
                        )}
                    </div>
                )}
            </div>

            <button
                onClick={onOpen}
                className="bg-cyan-500 hover:bg-cyan-600 text-white text-sm px-4 py-2 rounded-lg transition-colors ml-4"
            >
                Open
            </button>
        </div>
    );
}
