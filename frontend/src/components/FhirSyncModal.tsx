import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface FhirSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (data: FhirSyncResult) => void;
}

interface FhirSyncResult {
    patient: any;
    observations: any[];
    conditions: any[];
}

type SyncStep = 'connecting' | 'patient' | 'observations' | 'conditions' | 'processing' | 'complete';

const STEP_LABELS = {
    connecting: 'Connecting to Niraiva FHIR Server…',
    patient: 'Fetching Patient Details (FHIR Patient)…',
    observations: 'Fetching Vitals (FHIR Observation)…',
    conditions: 'Fetching Conditions (FHIR Condition)…',
    processing: 'Processing Data…',
    complete: 'Sync Complete!'
};

const STEP_DURATIONS = {
    connecting: 1500,
    patient: 1000,
    observations: 1000,
    conditions: 1000,
    processing: 1500,
    complete: 0
};

const SAMPLE_DATA = {
    patient: {
        resourceType: "Patient",
        id: "TEST-001",
        name: [{ given: ["Ragavi"], family: "Patient" }],
        gender: "female",
        birthDate: "2000-05-20",
        identifier: [
            {
                system: "https://healthid.ndhm.gov.in",
                value: "12-3456-7890-1234"
            }
        ]
    },
    observations: [
        {
            resourceType: "Observation",
            id: "obs-hr",
            code: { text: "Heart Rate", coding: [{ code: "8867-4", system: "http://loinc.org" }] },
            valueQuantity: { value: 78, unit: "bpm" },
            effectiveDateTime: new Date().toISOString()
        },
        {
            resourceType: "Observation",
            id: "obs-bp",
            code: { text: "Blood Pressure", coding: [{ code: "85354-9", system: "http://loinc.org" }] },
            component: [
                { code: { text: "Systolic" }, valueQuantity: { value: 120, unit: "mmHg" } },
                { code: { text: "Diastolic" }, valueQuantity: { value: 80, unit: "mmHg" } }
            ],
            effectiveDateTime: new Date().toISOString()
        },
        {
            resourceType: "Observation",
            id: "obs-spo2",
            code: { text: "Oxygen Saturation", coding: [{ code: "2708-6", system: "http://loinc.org" }] },
            valueQuantity: { value: 97, unit: "%" },
            effectiveDateTime: new Date().toISOString()
        },
        {
            resourceType: "Observation",
            id: "obs-weight",
            code: { text: "Body Weight", coding: [{ code: "29463-7", system: "http://loinc.org" }] },
            valueQuantity: { value: 62, unit: "kg" },
            effectiveDateTime: new Date().toISOString()
        },
        {
            resourceType: "Observation",
            id: "obs-height",
            code: { text: "Body Height", coding: [{ code: "8302-2", system: "http://loinc.org" }] },
            valueQuantity: { value: 168, unit: "cm" },
            effectiveDateTime: new Date().toISOString()
        }
    ],
    conditions: [
        {
            resourceType: "Condition",
            id: "cond-diabetes",
            code: { text: "Type 2 Diabetes" },
            clinicalStatus: { coding: [{ code: "active" }] },
            onsetDateTime: "2020-03-15"
        },
        {
            resourceType: "Condition",
            id: "cond-hypertension",
            code: { text: "Hypertension" },
            clinicalStatus: { coding: [{ code: "active" }] },
            onsetDateTime: "2021-08-20"
        }
    ]
};

export function FhirSyncModal({ isOpen, onClose, onComplete }: FhirSyncModalProps) {
    const [currentStep, setCurrentStep] = useState<SyncStep>('connecting');
    const [completedSteps, setCompletedSteps] = useState<Set<SyncStep>>(new Set());
    const [showEndpoint, setShowEndpoint] = useState<string>('');

    const steps: SyncStep[] = ['connecting', 'patient', 'observations', 'conditions', 'processing', 'complete'];

    useEffect(() => {
        if (!isOpen) {
            setCurrentStep('connecting');
            setCompletedSteps(new Set());
            setShowEndpoint('');
            return;
        }

        let timeout: NodeJS.Timeout;
        const currentIndex = steps.indexOf(currentStep);

        if (currentIndex < steps.length - 1) {
            // Show endpoint for API steps
            if (currentStep === 'connecting') {
                setShowEndpoint('GET https://fhir.niraiva.com/Patient');
            } else if (currentStep === 'patient') {
                setShowEndpoint('GET /Patient/TEST-001');
            } else if (currentStep === 'observations') {
                setShowEndpoint('GET /Observation?patient=TEST-001&category=vital-signs');
            } else if (currentStep === 'conditions') {
                setShowEndpoint('GET /Condition?patient=TEST-001');
            } else {
                setShowEndpoint('');
            }

            timeout = setTimeout(() => {
                setCompletedSteps(prev => new Set([...prev, currentStep]));
                setCurrentStep(steps[currentIndex + 1]);
            }, STEP_DURATIONS[currentStep]);
        } else if (currentStep === 'complete') {
            // Trigger completion callback
            onComplete({
                patient: SAMPLE_DATA.patient,
                observations: SAMPLE_DATA.observations,
                conditions: SAMPLE_DATA.conditions
            });
        }

        return () => clearTimeout(timeout);
    }, [isOpen, currentStep]);

    const getStepIcon = (step: SyncStep) => {
        if (completedSteps.has(step)) {
            return <Check className="w-5 h-5 text-green-500" />;
        }
        if (step === currentStep) {
            return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
        }
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    };

    const getJsonPreview = () => {
        if (currentStep === 'patient' || (completedSteps.has('patient') && currentStep === 'observations')) {
            return JSON.stringify(SAMPLE_DATA.patient, null, 2).substring(0, 200) + '...';
        }
        if (currentStep === 'observations' || (completedSteps.has('observations') && currentStep === 'conditions')) {
            return JSON.stringify(SAMPLE_DATA.observations[0], null, 2).substring(0, 200) + '...';
        }
        if (currentStep === 'conditions' || completedSteps.has('conditions')) {
            return JSON.stringify(SAMPLE_DATA.conditions[0], null, 2).substring(0, 150) + '...';
        }
        return null;
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-dark-cardBorder"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-cardBorder p-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">FHIR Data Sync</h2>
                            <p className="text-sm text-light-subtext dark:text-dark-subtext mt-1">
                                Demonstrating how Niraiva uses FHIR R4 APIs to fetch health data
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>

                    {/* Progress Steps */}
                    <div className="p-6 space-y-4">
                        {steps.map((step, index) => (
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-start gap-4"
                            >
                                <div className="flex-shrink-0 mt-1">
                                    {getStepIcon(step)}
                                </div>
                                <div className="flex-1">
                                    <p className={`font-medium ${step === currentStep ? 'text-blue-600 dark:text-blue-400' :
                                            completedSteps.has(step) ? 'text-green-600 dark:text-green-400' :
                                                'text-light-subtext dark:text-dark-subtext'
                                        }`}>
                                        {STEP_LABELS[step]}
                                    </p>

                                    {/* Show endpoint for current step */}
                                    {step === currentStep && showEndpoint && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                        >
                                            <code className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                                                {showEndpoint}
                                            </code>
                                        </motion.div>
                                    )}

                                    {/* Show JSON preview */}
                                    {step === currentStep && getJsonPreview() && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="mt-2 p-3 bg-gray-900 dark:bg-black rounded-lg overflow-hidden"
                                        >
                                            <pre className="text-xs text-green-400 font-mono overflow-x-auto">
                                                {getJsonPreview()}
                                            </pre>
                                        </motion.div>
                                    )}

                                    {/* Processing animation */}
                                    {step === 'processing' && currentStep === 'processing' && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="mt-2 space-y-2"
                                        >
                                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: '0%' }}
                                                    animate={{ width: '100%' }}
                                                    transition={{ duration: 1.5 }}
                                                    className="h-full bg-blue-500"
                                                />
                                            </div>
                                            <p className="text-xs text-light-subtext dark:text-dark-subtext">
                                                Assembling data bundle... Mapping resources to Niraiva format...
                                            </p>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Success Screen */}
                    {currentStep === 'complete' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 border-t border-gray-200 dark:border-dark-cardBorder bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20"
                        >
                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold text-light-text dark:text-dark-text mb-2">
                                    FHIR Data Sync Successful 🎉
                                </h3>
                                <p className="text-light-subtext dark:text-dark-subtext mb-6">
                                    Your health data is now visible in your profile
                                </p>
                                <button
                                    onClick={onClose}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    View Synced FHIR Data
                                </button>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
