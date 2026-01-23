
import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import ReactFlow, { Controls, Background, MiniMap, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from 'lucide-react';

import {
    CONDITION_PATHWAYS
} from '@/modules/diagnostic-pathway/condition-pathways';
import {
    projectPathway
} from '@/modules/diagnostic-pathway/PathwayProjectionService';
import {
    buildGraph
} from '@/modules/diagnostic-pathway/PathwayGraphMapper';
import {
    layoutNodes
} from '@/utils/layoutNodes';
import {
    buildDiagnosticViewModel,
    DiagnosticViewModel
} from '@/modules/diagnostic-pathway/DiagnosticViewModelBuilder';
import { EvidenceSnapshot } from '@/components/EvidenceSnapshot';


async function fetchEvidenceForEvent(eventId: string) {
    const { data, error } = await supabase
        .from('clinical_events')
        .select(`
        id,
        event_name,
        event_type,
        event_date,
        metadata,
        parsed_reports (
          id,
          report_type,
          confidence,
          created_at,
          report_id,
          health_reports (
            uploaded_at,
            metadata,
            file_url,
            provider
          )
        )
      `)
        .eq('id', eventId)
        .single();

    if (error) throw error;
    return data;
}

export default function DiagnosticPathwayPage() {
    const { user } = useAuth();
    const patientId = user?.id;
    const [events, setEvents] = useState<any[]>([]);
    const [condition, setCondition] = useState('Hyperlipidemia');
    const [loading, setLoading] = useState(true);

    // New State for Evidence
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [evidence, setEvidence] = useState<any | null>(null);

    useEffect(() => {
        if (!patientId) return;

        setLoading(true);
        supabase
            .from('clinical_events')
            .select('*')
            .eq('patient_id', patientId)
            .order('event_date', { ascending: true })
            .then(res => {
                setEvents(res.data || []);
                setLoading(false);
            });
    }, [patientId]);

    // Derived View Model (No Hardcoding)
    const viewModel: DiagnosticViewModel | null = useMemo(() => {
        if (events.length === 0) return null;
        return buildDiagnosticViewModel(events);
    }, [events]);

    const pathway = CONDITION_PATHWAYS[condition];

    const graph = useMemo(() => {
        if (!pathway) return { nodes: [], edges: [] };

        const projected = projectPathway(pathway.steps, events);
        const raw = buildGraph(projected, pathway.edges);
        return layoutNodes(raw.nodes, raw.edges);
    }, [events, condition, pathway]);

    // Fetch evidence when a node is selected (projected node -> real event)
    useEffect(() => {
        if (!selectedEventId) {
            setEvidence(null);
            return;
        }

        const nodeLabel = graph.nodes.find(n => n.id === selectedEventId)?.data?.label;
        if (nodeLabel) {
            const match = events.find(e =>
                e.event_name?.toLowerCase().includes(nodeLabel.toLowerCase()) ||
                (nodeLabel.toLowerCase().includes('lipid') && e.event_name?.toLowerCase().includes('cholesterol')) ||
                (nodeLabel.toLowerCase().includes('statin') && e.event_name?.toLowerCase().includes('statin'))
            );

            if (match) {
                fetchEvidenceForEvent(match.id).then(setEvidence).catch(console.error);
            } else {
                // Clicked a pending node or one with no direct event match
                setEvidence(null);
            }
        }

    }, [selectedEventId, events, graph.nodes]);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <Loader className="h-8 w-8 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <div className="w-full h-screen flex flex-col bg-slate-50 overflow-hidden relative">
            <Navbar />

            {/* HEADER */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Diagnostic Pathway</h1>
                        <p className="text-sm text-slate-500">
                            Interactive visualization of your clinical history and treatment progression
                        </p>
                    </div>

                    {/* CONDITION PILLS */}
                    <div className="flex gap-2">
                        {Object.keys(CONDITION_PATHWAYS).map(c => (
                            <button
                                key={c}
                                onClick={() => setCondition(c)}
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${c === condition
                                    ? 'bg-teal-600 text-white ring-2 ring-teal-600 ring-offset-2'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* SUMMARY + TRENDS (Real Data) */}
                {viewModel ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Status</h3>
                                <p className="font-medium text-slate-900">
                                    {viewModel.summary.status === 'Controlled' ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                            Stable / Controlled
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                            Attention Needed
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Latest Note</h3>
                                <p className="text-sm text-teal-600 font-medium truncate max-w-sm">
                                    {viewModel.notes[0]?.description || "No recent updates"}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 italic">No clinical data available. Upload reports to see analysis.</div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden relative min-h-0">
                {/* ABOUT PANEL (Left) */}
                <div className="w-64 bg-white border-r border-slate-200 p-4 hidden lg:block z-10">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                        <b className="block mb-2 text-blue-900">About this view</b>
                        <p>
                            Each node represents a key diagnostic or treatment step based on medical guidelines.
                        </p>
                        <ul className="mt-2 list-disc pl-4 space-y-1 text-xs">
                            <li>Completed steps are green</li>
                            <li>Pending steps are dashed</li>
                            <li>Click nodes for evidence</li>
                        </ul>
                    </div>

                    {/* Derived Treatment List */}
                    {viewModel && viewModel.treatment.medications.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Protocol</h4>
                            <ul className="space-y-2">
                                {viewModel.treatment.medications.map((m, i) => (
                                    <li key={i} className="text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                        <div className="font-bold text-slate-700">{m.name}</div>
                                        <div className="text-slate-500">{m.dose} {m.frequency}</div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* GRAPH (Main) */}
                <div className="flex-1 bg-slate-50 relative">
                    <ReactFlow
                        nodes={graph.nodes}
                        edges={graph.edges}
                        onNodeClick={(_, node) => setSelectedEventId(node.id)}
                        fitView
                        panOnScroll
                        zoomOnScroll
                        minZoom={0.5}
                        maxZoom={1.5}
                    >
                        <Background color="#cbd5e1" gap={20} />
                        <Controls position="bottom-right" />
                        <MiniMap position="bottom-left" className="!bg-white !border-slate-200" />
                    </ReactFlow>
                </div>

                {/* Evidence Snapshot (Right Overlay) */}
                {evidence && (
                    <EvidenceSnapshot
                        evidence={evidence}
                        onClose={() => {
                            setEvidence(null);
                            setSelectedEventId(null);
                        }}
                    />
                )}
            </div>

        </div>
    );
}
