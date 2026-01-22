import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/lib/fhir';

export interface Report {
    id: string;
    name: string;
    title?: string;
    summary?: string;
    date: string;
    uploaded_at: string;
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
            console.log('🔍 [ReportContext] Fetching reports for user:', userId);

            const apiBase = getApiBaseUrl();
            console.log('📡 [ReportContext] START fetch backend reports from:', `${apiBase}/api/reports/patient/${userId}`);

            const response = await fetch(`${apiBase}/api/reports/patient/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('❌ Backend reports fetch failed:', response.status);
                setLoading(false);
                return;
            }

            const result = await response.json();
            const data = result.reports || [];

            console.log('📡 [ReportContext] END fetch backend reports:', data.length);
            console.log('📊 Fetched reports from DB via Backend:', data.length);

            if (data) {
                console.log('📦 Raw data from Supabase:', JSON.stringify(data, null, 2));

                // Transform backend data to match Report interface
                const transformedReports: Report[] = data.map((report: any, index: number) => {
                    // Match the shape returned by backend/src/routes/reports.ts
                    // which is { id, filename, status, uploadedAt, parsedData, source }
                    // OR the raw DB shape { id, report_json, uploaded_at, file_type, patient_id }

                    const rJson = report.parsedData || report.report_json;
                    const upAt = report.uploadedAt || report.uploaded_at;
                    const fType = report.source || report.file_type;
                    const pId = report.patient_id || 'N/A';

                    return {
                        id: report.id,
                        name: fType || 'Health Report',
                        title: rJson?.metadata?.title || fType || 'Medical Report',
                        summary: rJson?.summary || report.summary || 'Clinical record processed',
                        date: upAt,
                        uploaded_at: upAt,
                        patientId: pId,
                        report_json: rJson,
                        content: {
                            profile: rJson?.data?.profile,
                            extractedParameters: rJson?.data?.parameters || [],
                            extractedMedications: rJson?.data?.medications || [],
                            extractedAllergies: rJson?.data?.profile?.allergies || []
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

    // Load reports when user logs in (ONLY for patients)
    useEffect(() => {
        if (user?.id && user?.role === 'patient') {
            console.log('👤 Patient logged in, fetching reports...');
            fetchReports(user.id);
        } else {
            console.log('👤 No patient user, clearing reports');
            setReports([]);
            setLoading(false);
        }
    }, [user?.id, user?.role]);

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
