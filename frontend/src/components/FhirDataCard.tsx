import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Activity, Heart, Droplet, Weight, Ruler } from 'lucide-react';

interface FhirDataCardProps {
    data: {
        patient: any;
        observations: any[];
        conditions: any[];
    };
}

export function FhirDataCard({ data }: FhirDataCardProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(section)) {
                newSet.delete(section);
            } else {
                newSet.add(section);
            }
            return newSet;
        });
    };

    const getVitalIcon = (code: string) => {
        if (code.includes('Heart') || code.includes('8867-4')) return <Heart className="w-4 h-4" />;
        if (code.includes('Blood Pressure') || code.includes('85354-9')) return <Activity className="w-4 h-4" />;
        if (code.includes('Oxygen') || code.includes('2708-6')) return <Droplet className="w-4 h-4" />;
        if (code.includes('Weight') || code.includes('29463-7')) return <Weight className="w-4 h-4" />;
        if (code.includes('Height') || code.includes('8302-2')) return <Ruler className="w-4 h-4" />;
        return <Activity className="w-4 h-4" />;
    };

    const formatValue = (obs: any) => {
        if (obs.valueQuantity) {
            return `${obs.valueQuantity.value} ${obs.valueQuantity.unit}`;
        }
        if (obs.component) {
            return obs.component.map((c: any) =>
                `${c.valueQuantity.value} ${c.valueQuantity.unit}`
            ).join('/');
        }
        return 'N/A';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-cardBorder p-6 space-y-6"
        >
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text">FHIR Data Snapshot</h3>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
                    FHIR R4
                </span>
            </div>

            {/* Patient Info */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">👤</span>
                    <h4 className="font-semibold text-light-text dark:text-dark-text">Patient Info</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 pl-8">
                    <div>
                        <p className="text-xs text-light-subtext dark:text-dark-subtext">Name</p>
                        <p className="font-medium text-light-text dark:text-dark-text">
                            {data.patient.name?.[0]?.given?.[0]} {data.patient.name?.[0]?.family}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-light-subtext dark:text-dark-subtext">Gender</p>
                        <p className="font-medium text-light-text dark:text-dark-text capitalize">
                            {data.patient.gender}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-light-subtext dark:text-dark-subtext">Date of Birth</p>
                        <p className="font-medium text-light-text dark:text-dark-text">
                            {new Date(data.patient.birthDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-light-subtext dark:text-dark-subtext">ABHA Number</p>
                        <p className="font-medium text-light-text dark:text-dark-text font-mono text-sm">
                            {data.patient.identifier?.[0]?.value || 'N/A'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Latest Vitals */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">📊</span>
                    <h4 className="font-semibold text-light-text dark:text-dark-text">Latest Vitals</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-2 px-3 text-light-subtext dark:text-dark-subtext font-medium">Vital</th>
                                <th className="text-right py-2 px-3 text-light-subtext dark:text-dark-subtext font-medium">Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.observations.map((obs, index) => (
                                <tr key={index} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                                    <td className="py-3 px-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-blue-500 dark:text-blue-400">
                                                {getVitalIcon(obs.code.text)}
                                            </span>
                                            <span className="text-light-text dark:text-dark-text">{obs.code.text}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3 text-right font-medium text-light-text dark:text-dark-text">
                                        {formatValue(obs)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Conditions */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🧾</span>
                    <h4 className="font-semibold text-light-text dark:text-dark-text">Conditions</h4>
                </div>
                <div className="space-y-2 pl-8">
                    {data.conditions.map((cond, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-light-text dark:text-dark-text">{cond.code.text}</span>
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                                {cond.clinicalStatus.coding[0].code}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Expandable JSON Sections */}
            <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-light-subtext dark:text-dark-subtext mb-3">
                    View Raw FHIR Responses
                </p>

                {/* Patient JSON */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('patient')}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <span className="text-sm font-medium text-light-text dark:text-dark-text">
                            FHIR Patient JSON
                        </span>
                        {expandedSections.has('patient') ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                    </button>
                    {expandedSections.has('patient') && (
                        <div className="p-4 bg-gray-900 dark:bg-black overflow-x-auto">
                            <pre className="text-xs text-green-400 font-mono">
                                {JSON.stringify(data.patient, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Observations JSON */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('observations')}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <span className="text-sm font-medium text-light-text dark:text-dark-text">
                            FHIR Observation Bundle JSON
                        </span>
                        {expandedSections.has('observations') ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                    </button>
                    {expandedSections.has('observations') && (
                        <div className="p-4 bg-gray-900 dark:bg-black overflow-x-auto">
                            <pre className="text-xs text-green-400 font-mono">
                                {JSON.stringify({ resourceType: "Bundle", entry: data.observations }, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Conditions JSON */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('conditions')}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <span className="text-sm font-medium text-light-text dark:text-dark-text">
                            FHIR Conditions JSON
                        </span>
                        {expandedSections.has('conditions') ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                    </button>
                    {expandedSections.has('conditions') && (
                        <div className="p-4 bg-gray-900 dark:bg-black overflow-x-auto">
                            <pre className="text-xs text-green-400 font-mono">
                                {JSON.stringify(data.conditions, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>

            {/* Educational Panel */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h5 className="font-semibold text-light-text dark:text-dark-text mb-3 flex items-center gap-2">
                    <span>🔧</span>
                    How Niraiva Uses FHIR
                </h5>
                <p className="text-sm text-light-subtext dark:text-dark-subtext mb-3">
                    Niraiva communicates with a FHIR server using:
                </p>
                <ul className="text-sm text-light-subtext dark:text-dark-subtext space-y-1 ml-4 list-disc">
                    <li>FHIR R4 resources</li>
                    <li>RESTful API calls</li>
                    <li>HAPI FHIR compatible backend</li>
                </ul>
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-light-subtext dark:text-dark-subtext font-medium mb-2">Standard endpoints:</p>
                    <div className="space-y-1">
                        <code className="block text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
                            /Patient
                        </code>
                        <code className="block text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
                            /Observation
                        </code>
                        <code className="block text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
                            /Condition
                        </code>
                    </div>
                </div>
                <div className="mt-3">
                    <p className="text-xs text-light-subtext dark:text-dark-subtext">
                        ✅ Interoperability with ABDM
                    </p>
                </div>
                <a
                    href="https://www.hl7.org/fhir/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                    Learn more about FHIR →
                </a>
            </div>
        </motion.div>
    );
}
