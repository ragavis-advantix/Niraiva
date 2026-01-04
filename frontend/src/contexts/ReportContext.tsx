import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/lib/fhir';

export interface Report {
    id: string;
    name: string;
    date: string;
    patientId: string;
    report_json: any; // ✅ REQUIRED
    content?: {
        profile?: {
            bloodType?: string;
        };
        extractedParameters?: Array<any>;
        extractedMedications?: Array<any>;
        extractedAllergies?: Array<any>;
    };
}

interface ReportContextType {
    reports: Report[];
    addReport: (file: File) => Promise<void>;
    removeReport: (id: string) => void;
    isProcessing: boolean;
    loading: boolean;
    refreshReports: () => Promise<void>;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export function ReportProvider({ children }: { children: ReactNode }) {
    const [reports, setReports] = useState<Report[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const { user, session } = useAuth();

    // Fetch reports from Supabase
    const fetchReports = async (userId: string) => {
        try {
            setLoading(true);
            console.log('🔍 Fetching reports for user:', userId);

            const { data, error } = await supabase
                .from('health_reports')
                .select('*')
                .eq('user_id', userId)
                .order('uploaded_at', { ascending: false });

            if (error) {
                console.error('❌ Error fetching reports:', error);
                return;
            }

            console.log('📊 Fetched reports from DB:', data?.length || 0);

            if (data) {
                console.log('📦 Raw data from Supabase:', JSON.stringify(data, null, 2));

                // Transform backend data to match Report interface
                const transformedReports: Report[] = data.map((report, index) => {
                    console.log(`🔄 Transforming report ${index + 1}:`, {
                        id: report.id,
                        file_type: report.file_type,
                        patient_id: report.patient_id,
                        uploaded_at: report.uploaded_at,
                        has_report_json: !!report.report_json
                    });

                    return {
                        id: report.id,
                        name: report.file_type || 'Health Report',
                        date: report.uploaded_at,
                        patientId: report.patient_id || 'N/A',
                        report_json: report.report_json, // ✅ DO NOT STRIP THIS
                        content: {
                            profile: report.report_json?.data?.profile,
                            extractedParameters: report.report_json?.data?.parameters || [],
                            extractedMedications: report.report_json?.data?.medications || [],
                            extractedAllergies: report.report_json?.data?.profile?.allergies || []
                        }
                    };
                });

                console.log('✅ Reports updated in state:', transformedReports.length);
                console.log('📋 Transformed reports:', transformedReports.map(r => ({
                    id: r.id,
                    name: r.name,
                    date: r.date
                })));

                setReports(transformedReports);
            }
        } catch (error) {
            console.error('❌ Error in fetchReports:', error);
        } finally {
            setLoading(false);
        }
    };

    // Refresh reports (exposed for external use)
    const refreshReports = async () => {
        if (user?.id) {
            await fetchReports(user.id);
        }
    };

    // Load reports when user logs in
    useEffect(() => {
        if (user?.id) {
            console.log('👤 User logged in, fetching reports...');
            fetchReports(user.id);
        } else {
            console.log('👤 No user, clearing reports');
            setReports([]);
            setLoading(false);
        }
    }, [user?.id]);

    const addReport = async (file: File) => {
        if (!user?.id || !session?.access_token) {
            toast({
                title: "Authentication Required",
                description: "Please log in to upload reports.",
                variant: "destructive"
            });
            return;
        }

        setIsProcessing(true);

        try {
            console.log('📤 Uploading file:', file.name);

            // Create FormData for file upload
            const formData = new FormData();
            formData.append('file', file);

            // Upload to backend API
            const apiBase = getApiBaseUrl();
            const response = await fetch(`${apiBase}/api/upload-report`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Upload failed: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Upload successful:', result);

            // Backend already saves to Supabase, so just refresh the list
            await fetchReports(user.id);

            toast({
                title: "Report Processed",
                description: `${file.name} has been successfully processed and saved.`,
            });
        } catch (error: any) {
            console.error('❌ Error processing report:', error);
            toast({
                title: "Processing Failed",
                description: error.message || `Failed to process ${file.name}. Please try again.`,
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const removeReport = async (id: string) => {
        if (!user?.id) return;

        try {
            // Delete from Supabase
            const { error } = await supabase
                .from('health_reports')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;

            // Update local state
            setReports(prev => prev.filter(report => report.id !== id));

            toast({
                title: "Report Removed",
                description: "The report has been removed from your records.",
            });
        } catch (error) {
            console.error('Error removing report:', error);
            toast({
                title: "Removal Failed",
                description: "Failed to remove the report. Please try again.",
                variant: "destructive"
            });
        }
    };

    return (
        <ReportContext.Provider value={{ reports, addReport, removeReport, isProcessing, loading, refreshReports }}>
            {children}
        </ReportContext.Provider>
    );
}

export function useReports() {
    const context = useContext(ReportContext);
    if (context === undefined) {
        throw new Error('useReports must be used within a ReportProvider');
    }
    return context;
}
