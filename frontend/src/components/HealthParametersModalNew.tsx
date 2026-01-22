import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { fetchTimelineParameters } from '@/features/timeline/fetchTimelineParameters';

interface HealthParametersModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventDate: string;
    eventTitle: string;
    metadata?: any;
    onOpenChat?: (context: any) => void;
}

interface HealthParameter {
    id: string;
    name: string;
    value: number | null;
    unit: string;
    status: 'normal' | 'warning' | 'critical';
    measured_at: string;
    source?: string;
    interpretation?: string;
}

interface ParameterGroup {
    group: string;
    icon: string;
    parameters: HealthParameter[];
    description: string;
}

// Clinical grouping logic - maps parameter names to clinical groups
const getParameterGroup = (paramName: string): { group: string; icon: string; description: string } => {
    const name = paramName.toLowerCase();

    // Kidney Function
    if (name.includes('creatinine') || name.includes('gfr') || name.includes('urea') || name.includes('bun')) {
        return {
            group: 'Kidney Function',
            icon: '🫘',
            description: 'Renal function and filtration markers'
        };
    }

    // Liver Function
    if (name.includes('ast') || name.includes('alt') || name.includes('bilirubin') || name.includes('albumin') || name.includes('protein')) {
        return {
            group: 'Liver Function',
            icon: '🫀',
            description: 'Hepatic function and synthesis markers'
        };
    }

    // Blood Glucose & Diabetes
    if (name.includes('glucose') || name.includes('hba1c') || name.includes('blood sugar') || name.includes('fasting')) {
        return {
            group: 'Glucose Metabolism',
            icon: '🩸',
            description: 'Blood sugar and diabetes markers'
        };
    }

    // Cardiovascular
    if (name.includes('cholesterol') || name.includes('ldl') || name.includes('hdl') || name.includes('triglyceride')) {
        return {
            group: 'Lipid Profile',
            icon: '💓',
            description: 'Cholesterol and lipid markers'
        };
    }

    // Complete Blood Count
    if (name.includes('hemoglobin') || name.includes('hematocrit') || name.includes('rbc') ||
        name.includes('wbc') || name.includes('platelet') || name.includes('blood cell')) {
        return {
            group: 'Complete Blood Count',
            icon: '🔴',
            description: 'Blood cell counts and oxygen capacity'
        };
    }

    // Thyroid
    if (name.includes('tsh') || name.includes('t3') || name.includes('t4') || name.includes('thyroid')) {
        return {
            group: 'Thyroid Function',
            icon: '🧬',
            description: 'Thyroid hormone levels'
        };
    }

    // Vitals
    if (name.includes('blood pressure') || name.includes('heart rate') || name.includes('temperature') ||
        name.includes('bp') || name.includes('pulse') || name.includes('spo2') || name.includes('oxygen')) {
        return {
            group: 'Vital Signs',
            icon: '🫀',
            description: 'Core vital measurements'
        };
    }

    // Body Measurements
    if (name.includes('bmi') || name.includes('weight') || name.includes('height') || name.includes('waist')) {
        return {
            group: 'Body Measurements',
            icon: '📏',
            description: 'Anthropometric measurements'
        };
    }

    // Default
    return {
        group: 'Other Parameters',
        icon: '📊',
        description: 'Additional health measurements'
    };
};

// Patient-friendly interpretation for abnormal values
const getParameterInterpretation = (paramName: string, status: string): string | null => {
    if (status === 'normal') return null;

    const name = paramName.toLowerCase();

    // Kidney Function
    if (name.includes('gfr') && status === 'warning') {
        return 'Your kidney function is lower than normal and may need monitoring. Your doctor may adjust medications.';
    }
    if (name.includes('creatinine') && status === 'warning') {
        return 'This kidney function marker is elevated, suggesting reduced filtration capacity.';
    }
    if (name.includes('urea') && status === 'warning') {
        return 'Blood urea is elevated, which may indicate kidney stress or dehydration.';
    }

    // Liver Function
    if ((name.includes('ast') || name.includes('alt')) && status === 'warning') {
        return 'These liver enzymes are elevated, which may indicate liver inflammation or stress.';
    }
    if (name.includes('bilirubin') && status === 'warning') {
        return 'Bilirubin is elevated, which may indicate jaundice or liver dysfunction. Consult your doctor.';
    }

    // Blood Glucose
    if (name.includes('glucose') && status === 'warning') {
        return 'Blood glucose is higher than normal. Monitor your diet and activity level.';
    }
    if (name.includes('hba1c') && status === 'warning') {
        return 'Your average blood sugar over the past 3 months is elevated. Diabetes management may need adjustment.';
    }

    // Cholesterol
    if (name.includes('ldl') && status === 'warning') {
        return 'LDL ("bad" cholesterol) is elevated. Consider diet changes and consult your doctor.';
    }
    if (name.includes('cholesterol') && status === 'warning') {
        return 'Total cholesterol is higher than recommended. Lifestyle modifications are recommended.';
    }

    // Blood Pressure
    if (name.includes('blood pressure') && status === 'warning') {
        return 'Your blood pressure is elevated. Monitor regularly and consult your doctor.';
    }

    // Hemoglobin
    if (name.includes('hemoglobin') && status === 'warning') {
        return 'Hemoglobin is low, which may indicate anemia. Iron and B12 should be evaluated.';
    }

    // Generic fallback for warning
    if (status === 'warning') {
        return `This value is higher than normal and may require attention. Discuss with your doctor.`;
    }

    // Critical status
    if (status === 'critical') {
        return `⚠️ This value is critically abnormal. Please contact your doctor immediately.`;
    }

    return null;
};

// Status summary with counts
const getStatusSummary = (parameters: HealthParameter[]): { normal: number; warning: number; critical: number } => {
    return {
        normal: parameters.filter(p => p.status === 'normal').length,
        warning: parameters.filter(p => p.status === 'warning').length,
        critical: parameters.filter(p => p.status === 'critical').length,
    };
};

// Group parameters by clinical category
const groupParameters = (parameters: HealthParameter[]): ParameterGroup[] => {
    const groups = new Map<string, ParameterGroup>();

    parameters.forEach(param => {
        const { group, icon, description } = getParameterGroup(param.name);

        if (!groups.has(group)) {
            groups.set(group, {
                group,
                icon,
                description,
                parameters: [],
            });
        }

        groups.get(group)!.parameters.push(param);
    });

    return Array.from(groups.values()).sort((a, b) => {
        // Prioritize groups with warnings/critical
        const aHasWarning = a.parameters.some(p => p.status !== 'normal');
        const bHasWarning = b.parameters.some(p => p.status !== 'normal');
        if (aHasWarning && !bHasWarning) return -1;
        if (!aHasWarning && bHasWarning) return 1;
        return a.group.localeCompare(b.group);
    });
};

const StatusBadge = ({ label, count, color }: { label: string; count: number; color: 'green' | 'amber' | 'red' }) => {
    const colorMap = {
        green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-700',
        amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-700',
        red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-100 dark:border-red-700',
    };

    return (
        <div className={cn('px-3 py-1.5 rounded-full text-sm font-medium border', colorMap[color])}>
            <span className="font-bold">{count}</span> {label}
        </div>
    );
};

const StatusPill = ({ status }: { status: 'normal' | 'warning' | 'critical' }) => {
    const colors = {
        normal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
        <span className={cn('text-xs font-semibold px-2 py-1 rounded-md capitalize', colors[status])}>
            {status}
        </span>
    );
};

const HealthParameterCard = ({ param }: { param: HealthParameter }) => {
    const interpretation = getParameterInterpretation(param.name, param.status);
    const isValid = param.value !== null && !isNaN(param.value);

    const statusColors = {
        normal: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
        warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
        critical: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'p-4 rounded-xl border transition-all hover:shadow-md',
                statusColors[param.status]
            )}
        >
            {/* Header: Name + Status Pill */}
            <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight pr-2">
                    {param.name}
                </h4>
                <StatusPill status={param.status} />
            </div>

            {/* Value + Unit */}
            <div className="mb-3">
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        {isValid ? param.value : 'N/A'}
                    </span>
                    {isValid && param.unit && (
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                            {param.unit}
                        </span>
                    )}
                </div>

                {!isValid && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Data not available
                    </p>
                )}
            </div>

            {/* Patient-Friendly Interpretation */}
            {interpretation && (
                <div className={cn(
                    'p-3 rounded-lg text-xs leading-relaxed border-l-2',
                    param.status === 'warning' ? 'bg-amber-100/30 border-amber-400 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200' :
                        param.status === 'critical' ? 'bg-red-100/30 border-red-400 text-red-900 dark:bg-red-900/20 dark:text-red-200' :
                            'bg-green-100/30 border-green-400 text-green-900 dark:bg-green-900/20 dark:text-green-200'
                )}>
                    {interpretation}
                </div>
            )}

            {/* Footer: Source + Date */}
            {(param.source || param.measured_at) && (
                <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                    {param.source && <p>📋 {param.source}</p>}
                    {param.measured_at && (
                        <p>📅 {new Date(param.measured_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })}</p>
                    )}
                </div>
            )}
        </motion.div>
    );
};

const HealthParametersModal: React.FC<HealthParametersModalProps> = ({
    isOpen,
    onClose,
    eventDate,
    eventTitle,
    metadata,
    onOpenChat,
}) => {
    const [parameters, setParameters] = useState<HealthParameter[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groupedParams, setGroupedParams] = useState<ParameterGroup[]>([]);
    const [statusSummary, setStatusSummary] = useState({ normal: 0, warning: 0, critical: 0 });

    // ===== PRODUCTION-SAFE DATA LOADING =====
    useEffect(() => {
        // Guard 1: Only load when modal is open
        if (!isOpen) {
            return;
        }

        // Guard 2: Require eventDate for query
        if (!eventDate) {
            console.warn('⚠️ eventDate is undefined, cannot load parameters');
            setLoading(false);
            setError('Missing event date');
            return;
        }

        let isMounted = true; // Prevent state update if component unmounts

        const loadParameters = async () => {
            setLoading(true);
            setError(null);

            try {
                console.log('🔍 Loading parameters for:', { eventTitle, eventDate, hasMetadata: !!metadata });

                // PRIORITY 1: Try metadata (parsed report data)
                if (metadata?.report_json?.data?.parameters) {
                    console.log('📦 Found parameters in metadata');
                    const params = metadata.report_json.data.parameters;

                    // Defensive: ensure array
                    if (!Array.isArray(params)) {
                        console.warn('⚠️ metadata.report_json.data.parameters is not an array');
                        throw new Error('Invalid parameter format in metadata');
                    }

                    const mappedParams: HealthParameter[] = params
                        .map((p: any, idx: number) => {
                            // Normalize status
                            let normalizedStatus = p.status || p.interpretation || 'normal';
                            if (normalizedStatus === 'improved' || normalizedStatus === 'stable') {
                                normalizedStatus = 'normal';
                            }
                            if (normalizedStatus === 'worsened') {
                                normalizedStatus = 'warning';
                            }

                            return {
                                id: p.id || `meta-${idx}`,
                                name: p.name || 'Unknown',
                                value: typeof p.value === 'number' ? p.value : (p.value ? parseFloat(String(p.value)) : null),
                                unit: p.unit || '',
                                status: normalizedStatus as 'normal' | 'warning' | 'critical',
                                measured_at: metadata.report_json.metadata?.documentDate || eventDate,
                                source: metadata.report_json.metadata?.provider || 'Parsed Report',
                                interpretation: p.interpretation,
                            };
                        })
                        .filter(p => p.name !== 'Unknown' && p.value !== null); // Filter invalid

                    if (mappedParams.length > 0) {
                        console.log(`✅ Loaded ${mappedParams.length} parameters from metadata`);
                        if (isMounted) {
                            setParameters(mappedParams);
                            setGroupedParams(groupParameters(mappedParams));
                            setStatusSummary(getStatusSummary(mappedParams));
                        }
                        return; // Success - exit
                    } else {
                        console.warn('⚠️ Metadata parameters empty after filtering, trying database');
                    }
                }

                // PRIORITY 2: Fall back to database query
                console.log('🗄️ Fetching parameters from database');
                const { data: { user }, error: userError } = await supabase.auth.getUser();

                if (userError || !user) {
                    throw new Error(`Auth failed: ${userError?.message || 'No user'}`);
                }

                console.log('👤 Querying for user:', user.id, 'date:', eventDate);
                const dbData = await fetchTimelineParameters(user.id, eventDate);

                if (!Array.isArray(dbData)) {
                    throw new Error('Database returned non-array data');
                }

                console.log(`✅ Loaded ${dbData.length} parameters from database`);

                if (isMounted) {
                    setParameters(dbData);
                    setGroupedParams(groupParameters(dbData));
                    setStatusSummary(getStatusSummary(dbData));
                }
            } catch (err: any) {
                console.error('❌ Error loading parameters:', err);
                if (isMounted) {
                    setError(err?.message || 'Failed to load parameters');
                    setParameters([]);
                    setGroupedParams([]);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        // ===== CRITICAL: Actually call the function! =====
        loadParameters();

        // Cleanup: prevent state updates on unmount
        return () => {
            isMounted = false;
        };

        // ===== DEPENDENCY: Only reload when these change =====
    }, [isOpen, eventDate]); // Remove metadata from deps - it's not a stable identifier

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-40"
                    />

                    {/* Modal Container - VIEWPORT CENTERED */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                    >
                        <div
                            className="w-full mx-4 max-w-5xl max-h-[85vh] bg-white dark:bg-slate-950 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl overflow-hidden flex flex-col pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >

                            {/* ===== STICKY HEADER ===== */}
                            <div className="sticky top-0 bg-white dark:bg-slate-950 z-10 border-b border-gray-200 dark:border-gray-800 p-6">
                                {/* Title & Subtitle */}
                                <div className="mb-4">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Health Parameters
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {eventTitle} • {new Date(eventDate).toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}
                                    </p>
                                </div>

                                {/* Status Summary Badges */}
                                {!loading && parameters.length > 0 && (
                                    <div className="flex gap-3 flex-wrap">
                                        {statusSummary.normal > 0 && (
                                            <StatusBadge label="Normal" count={statusSummary.normal} color="green" />
                                        )}
                                        {statusSummary.warning > 0 && (
                                            <StatusBadge label="Needs Attention" count={statusSummary.warning} color="amber" />
                                        )}
                                        {statusSummary.critical > 0 && (
                                            <StatusBadge label="Critical" count={statusSummary.critical} color="red" />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ===== SCROLLABLE CONTENT ===== */}
                            <div className="overflow-y-auto flex-1">
                                {loading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <div className="text-center">
                                            <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                Loading health parameters...
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                                Date: {eventDate}
                                            </p>
                                        </div>
                                    </div>
                                ) : error ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-6">
                                        <AlertCircle className="w-12 h-12 text-red-400 dark:text-red-600 mb-4" />
                                        <p className="text-red-600 dark:text-red-400 text-center font-medium">
                                            Error loading parameters
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-2">
                                            {error}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                                            Check browser console for details
                                        </p>
                                    </div>
                                ) : parameters.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-6">
                                        <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                                        <p className="text-gray-600 dark:text-gray-400 text-center font-medium">
                                            No health parameters found for this date.
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                            {eventDate}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="px-6 pb-6 space-y-6">
                                        {/* GROUPED PARAMETERS */}
                                        {groupedParams.map((group, groupIdx) => (
                                            <motion.section
                                                key={group.group}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: groupIdx * 0.05 }}
                                            >
                                                {/* Section Header */}
                                                <div className="mb-4">
                                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                                        <span className="text-2xl">{group.icon}</span>
                                                        {group.group}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        {group.description}
                                                    </p>
                                                </div>

                                                {/* TWO-COLUMN GRID */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    {group.parameters.map((param) => (
                                                        <HealthParameterCard key={param.id} param={param} />
                                                    ))}
                                                </div>
                                            </motion.section>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ===== FOOTER ===== */}
                            <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-slate-900 flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-gray-700 rounded-lg transition"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        console.log('🔍 Ask AI About This clicked', { onOpenChat: !!onOpenChat });
                                        if (onOpenChat) {
                                            console.log('✅ Calling onOpenChat with parameters');
                                            onOpenChat();
                                        } else {
                                            console.warn('❌ onOpenChat is undefined');
                                        }
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition"
                                >
                                    Ask AI About This
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default HealthParametersModal;
