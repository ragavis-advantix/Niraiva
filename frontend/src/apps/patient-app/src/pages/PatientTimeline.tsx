import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';

interface TimelineEvent {
    id: string;
    event_type: string;
    authority: 'clinical' | 'personal';
    event_time: string;
    metadata: any;
    reference_table: string;
}

export const PatientTimeline: React.FC = () => {
    const { user } = useAuth();
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchTimeline();
    }, []);

    const fetchTimeline = async () => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/timeline/patient/${user?.linked_patient_id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${user?.access_token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch timeline');
            }

            setEvents(data.events);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getEventIcon = (event: TimelineEvent) => {
        if (event.authority === 'personal') {
            return (
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
            );
        }

        // Clinical events
        switch (event.event_type) {
            case 'test':
                return (
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                );
            case 'medication':
                return (
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                );
            default:
                return (
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                );
        }
    };

    const getEventTitle = (event: TimelineEvent) => {
        if (event.authority === 'personal') {
            return event.metadata?.type || event.event_type;
        }
        return event.metadata?.record_type || event.event_type;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{error}</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Health Timeline</h1>

            {events.length === 0 ? (
                <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-600">No timeline events yet</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {events.map((event, index) => (
                        <div key={event.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                {getEventIcon(event)}
                                {index < events.length - 1 && (
                                    <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                                )}
                            </div>

                            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{getEventTitle(event)}</h3>
                                        <p className="text-sm text-gray-500">{formatDate(event.event_time)}</p>
                                    </div>
                                    <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${event.authority === 'clinical'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                        }`}>
                                        {event.authority === 'clinical' ? 'Doctor-reported' : 'You added'}
                                    </span>
                                </div>

                                {event.metadata?.source && (
                                    <p className="text-sm text-gray-600 mb-2">Source: {event.metadata.source}</p>
                                )}

                                {event.metadata?.report_json && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs font-medium text-gray-700 mb-2">Details:</p>
                                        <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                                            {JSON.stringify(event.metadata.report_json, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
