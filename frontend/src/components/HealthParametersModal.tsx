import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
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
}

interface HealthParameter {
    id: string;
    name: string;
    value: number;
    unit: string;
    status: 'normal' | 'warning' | 'critical';
    measured_at: string;
    source?: string;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'normal':
            return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
        case 'warning':
            return 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800';
        case 'critical':
            return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
        default:
            return 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-800';
    }
};

const getStatusBadgeColor = (status: string) => {
    switch (status) {
        case 'normal':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
        case 'warning':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100';
        case 'critical':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
};

const HealthParametersModal: React.FC<HealthParametersModalProps> = ({
    isOpen,
    onClose,
    eventDate,
    eventTitle,
    metadata,
}) => {
    const [parameters, setParameters] = useState<HealthParameter[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadParameters() {
            if (!isOpen) return;

            setLoading(true);
            try {
                console.log('🔍 Modal opened for:', eventTitle, 'Date:', eventDate);

                // 1. Try to use metadata if available (HIGHEST PRIORITY)
                if (metadata?.report_json?.data?.parameters) {
                    console.log('📦 Using parameters from metadata');
                    const params = metadata.report_json.data.parameters;
                    const mappedParams: HealthParameter[] = (Array.isArray(params) ? params : []).map((p: any, idx: number) => {
                        // Normalize status values that might come from AI
                        let normalizedStatus = p.status || 'normal';
                        if (normalizedStatus === 'improved' || normalizedStatus === 'stable') normalizedStatus = 'normal';
                        if (normalizedStatus === 'worsened') normalizedStatus = 'warning';

                        return {
                            id: p.id || `meta-${idx}`,
                            name: p.name || 'Unknown',
                            value: typeof p.value === 'number' ? p.value : parseFloat(String(p.value || 0)),
                            unit: p.unit || '',
                            status: normalizedStatus as any,
                            measured_at: metadata.report_json.metadata?.documentDate || eventDate,
                            source: metadata.report_json.metadata?.provider || 'Parsed Report'
                        };
                    });

                    if (mappedParams.length > 0) {
                        setParameters(mappedParams);
                        setLoading(false);
                        return;
                    }
                }

                // 2. Fallback to existing fetch logic
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    console.warn('❌ No user found');
                    setLoading(false);
                    return;
                }

                console.log('👤 Fetching parameters from DB for user:', user.id);
                const data = await fetchTimelineParameters(user.id, eventDate);
                console.log('✅ Fetched parameters from DB:', data);
                setParameters(data);
            } catch (error) {
                console.error('❌ Error loading parameters:', error);
            } finally {
                setLoading(false);
            }
        }

        loadParameters();
    }, [isOpen, eventDate, metadata, eventTitle]);

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

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl"
                    >
                        <Card className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-gray-800 shadow-xl rounded-lg">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Health Parameters
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {eventTitle}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                        {new Date(eventDate).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                                >
                                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 max-h-96 overflow-y-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-center">
                                            <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                Loading health parameters...
                                            </p>
                                        </div>
                                    </div>
                                ) : parameters.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                                        <p className="text-gray-600 dark:text-gray-400">
                                            No health parameters found for this date.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {parameters.map((param) => (
                                            <motion.div
                                                key={param.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={cn(
                                                    'p-4 rounded-lg border transition-all',
                                                    getStatusColor(param.status)
                                                )}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                                            {param.name}
                                                        </h3>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            {new Date(param.measured_at).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={cn(
                                                            'px-2 py-1 text-xs font-medium rounded',
                                                            getStatusBadgeColor(param.status)
                                                        )}
                                                    >
                                                        {param.status}
                                                    </span>
                                                </div>

                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                                        {param.value}
                                                    </span>
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {param.unit}
                                                    </span>
                                                </div>

                                                {param.source && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
                                                        Source: {param.source}
                                                    </p>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                                >
                                    Close
                                </button>
                            </div>
                        </Card>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default HealthParametersModal;
