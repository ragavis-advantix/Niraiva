import React from 'react';
import { Eye } from 'lucide-react';

function calculateAge(dob: string) {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    // Validate age range
    if (age < 0 || age > 120) return null;
    return age;
}

interface PatientCardProps {
    patient: {
        user_id: string;
        name: string;
        gender?: string;
        dob?: string;
        phone?: string;
        chronic_conditions?: string[];
    };
    onOpen: () => void;
}

export default function PatientCard({ patient, onOpen }: PatientCardProps) {
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const age = patient.dob ? calculateAge(patient.dob) : null;

    return (
        <div className="bg-white rounded-xl shadow-sm p-5 flex justify-between items-center hover:shadow-lg hover:scale-[1.01] transition-all duration-200 border border-gray-100 group cursor-pointer" onClick={onOpen}>
            <div className="flex items-center gap-4 flex-1">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                    {getInitials(patient.name)}
                </div>

                {/* Patient Info - Reordered for clinical scanning */}
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-lg">
                            {patient.name}
                        </h3>
                        {/* Condition badges next to name for quick scanning */}
                        {patient.chronic_conditions && patient.chronic_conditions.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                <span className="inline-block px-2.5 py-0.5 bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 text-xs rounded-full font-medium border border-orange-200">
                                    {patient.chronic_conditions[0]}
                                </span>
                                {patient.chronic_conditions.length > 1 && (
                                    <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                                        +{patient.chronic_conditions.length - 1} more
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="inline-block px-2.5 py-0.5 bg-gray-50 text-gray-400 text-xs rounded-full font-medium border border-gray-200">
                                No chronic conditions
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                        <span>{patient.gender || 'N/A'}</span>
                        <span className="text-gray-400">•</span>
                        <span title={age === null ? 'Invalid DOB data' : undefined}>
                            {age !== null ? `${age} yrs` : 'Age unavailable'}
                        </span>
                    </p>
                    {patient.phone && (
                        <p className="text-xs text-gray-500 mt-1">
                            📞 {patient.phone}
                        </p>
                    )}
                </div>
            </div>

            {/* Action Button with Eye icon */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                }}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg group-hover:scale-105 flex items-center gap-2"
            >
                <Eye className="w-4 h-4" />
                View Profile
            </button>
        </div>
    );
}
