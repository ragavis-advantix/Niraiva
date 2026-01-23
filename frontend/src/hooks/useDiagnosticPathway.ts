import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export interface PathwayNode {
    id: string;
    data: {
        label: string;
        type: string;
        date?: string;
        confidence?: number;
        metadata?: any;
        sourceReportId?: string;
    };
    position: { x: number; y: number };
    style?: any;
    type?: string;
}

export interface PathwayEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    data?: {
        relationType: string;
        confidence?: number;
    };
    animated?: boolean;
    style?: any;
}

export interface DiagnosticPathwayData {
    nodes: PathwayNode[];
    edges: PathwayEdge[];
    diagnoses: Array<{
        id: string;
        name: string;
        date: string;
        confidence: number;
    }>;
}

export const useDiagnosticPathway = (patientId?: string, condition?: string | null) => {
    const { user } = useAuth();
    const [data, setData] = useState<DiagnosticPathwayData>({ nodes: [], edges: [], diagnoses: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!patientId || !user?.id) {
            setLoading(false);
            return;
        }

        const fetchPathway = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get the current session token from Supabase
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                if (!token) {
                    throw new Error('No auth token available');
                }

                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const query = condition ? `?conditionFilter=${encodeURIComponent(condition)}` : '';
                const response = await fetch(
                    `${apiUrl}/api/diagnostic-pathway/${patientId}${query}`,
                    {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error(`Failed to fetch pathway: ${response.statusText}`);
                }

                const pathwayData = await response.json();
                setData(pathwayData);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                setError(message);
                console.error('Failed to fetch diagnostic pathway:', err);
                setData({ nodes: [], edges: [], diagnoses: [] });
            } finally {
                setLoading(false);
            }
        };

        fetchPathway();
    }, [patientId, user?.id, condition]);

    return { data, loading, error };
};
