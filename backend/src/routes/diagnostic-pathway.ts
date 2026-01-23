import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { pathwayProjectionService } from '../modules/diagnostic-pathway/PathwayProjectionService';

const router = express.Router();

/**
 * GET /api/diagnostic-pathway/:patientId/summary
 * 
 * Returns clinical summary data from latest health reports
 * Includes parameters, medications, conditions, and treatment info
 */
router.get('/:patientId/summary', async (req: Request, res: Response) => {
    try {
        const { patientId } = req.params;

        console.log(`📋 [DiagnosticPathway] Fetching clinical summary for patient ${patientId}`);

        // Fetch all health reports for patient, ordered by latest first
        const { data: reports, error: reportsError } = await supabase
            .from('health_reports')
            .select('id, report_json, uploaded_at, patient_id')
            .eq('patient_id', patientId)
            .order('uploaded_at', { ascending: false });

        if (reportsError) throw reportsError;

        if (!reports || reports.length === 0) {
            console.log(`ℹ️ [DiagnosticPathway] No reports found for patient`);
            return res.json({
                parameters: [],
                medications: [],
                conditions: [],
                treatments: [],
                lastUpdated: null,
                reportCount: 0
            });
        }

        // Extract and aggregate data from all reports
        const allParameters: any[] = [];
        const allMedications: any[] = [];
        const allConditions: any[] = [];
        const treatmentNotes: string[] = [];
        let mostRecentReport = reports[0];

        // Process reports in reverse order (oldest to newest) to track trends
        reports.forEach((report, index) => {
            if (!report.report_json) return;

            const reportData = report.report_json.data || {};

            // Collect parameters with report metadata
            if (Array.isArray(reportData.parameters)) {
                reportData.parameters.forEach((param: any) => {
                    allParameters.push({
                        ...param,
                        source_report_id: report.id,
                        recorded_at: report.uploaded_at
                    });
                });
            }

            // Collect medications
            if (Array.isArray(reportData.medications)) {
                reportData.medications.forEach((med: any) => {
                    allMedications.push({
                        ...med,
                        source_report_id: report.id,
                        recorded_at: report.uploaded_at
                    });
                });
            }

            // Collect conditions
            if (Array.isArray(reportData.conditions)) {
                reportData.conditions.forEach((cond: any) => {
                    allConditions.push({
                        ...cond,
                        source_report_id: report.id,
                        recorded_at: report.uploaded_at
                    });
                });
            }

            // Extract treatment recommendations (from clinical notes or summary)
            if (reportData.clinicalInfo?.treatmentPlan || reportData.summary) {
                const treatment = reportData.clinicalInfo?.treatmentPlan || reportData.summary;
                if (treatment && !treatmentNotes.includes(treatment)) {
                    treatmentNotes.push(treatment);
                }
            }
        });

        // Deduplicate parameters (keep latest per parameter name)
        const paramMap = new Map<string, any>();
        allParameters.forEach(param => {
            const key = (param.name || param.parameter_name || '').toLowerCase();
            if (!paramMap.has(key) || new Date(param.recorded_at) > new Date(paramMap.get(key).recorded_at)) {
                paramMap.set(key, param);
            }
        });

        // Deduplicate medications (keep latest per medication name)
        const medMap = new Map<string, any>();
        allMedications.forEach(med => {
            const key = (med.name || '').toLowerCase();
            if (!medMap.has(key) || new Date(med.recorded_at) > new Date(medMap.get(key).recorded_at)) {
                medMap.set(key, med);
            }
        });

        // Deduplicate conditions (keep latest per condition name)
        const condMap = new Map<string, any>();
        allConditions.forEach(cond => {
            const key = (cond.name || '').toLowerCase();
            if (!condMap.has(key) || new Date(cond.recorded_at) > new Date(condMap.get(key).recorded_at)) {
                condMap.set(key, cond);
            }
        });

        return res.json({
            parameters: Array.from(paramMap.values()),
            medications: Array.from(medMap.values()),
            conditions: Array.from(condMap.values()),
            treatments: treatmentNotes,
            lastUpdated: mostRecentReport.uploaded_at,
            reportCount: reports.length,
            mostRecentReportId: mostRecentReport.id
        });

    } catch (error: any) {
        console.error('❌ [DiagnosticPathway] Summary error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

/**
 * GET /api/diagnostic-pathway/:patientId
 * 
 * Returns a graph-ready diagnostic pathway with nodes and edges
 * Suitable for React Flow or D3 visualization
 */
router.get('/:patientId', async (req: Request, res: Response) => {
    try {
        const { patientId } = req.params;
        const { conditionFilter } = req.query; // Optional: filter by diagnosis name

        console.log(`📊 [DiagnosticPathway] Fetching pathway for patient ${patientId}`);

        // 2. Apply condition filter logic (Guide-line based vs Raw)
        if (conditionFilter) {
            console.log(`🔍 [DiagnosticPathway] Using guideline projection for: ${conditionFilter}`);

            // Try to project onto a template
            const projectedGraph = await pathwayProjectionService.projectPathway(patientId, conditionFilter as string);

            if (projectedGraph) {
                // Transform projected steps to React Flow nodes
                const nodes = projectedGraph.steps.map((step, idx) => ({
                    id: step.id,
                    data: {
                        label: step.label,
                        type: step.type,
                        status: step.status,
                        description: step.description,
                        originalEvent: step.matchedEvent // Pass the real patient data
                    },
                    position: { x: 0, y: 0 }, // Layout will be handled by UI (Dagre)
                    type: 'default', // Using default node type for now, or custom
                    style: getNodeStyle(step.type, step.status) // Update style helper to handle status
                }));

                // Transform edges
                const edges = projectedGraph.edges.map(([source, target]) => ({
                    id: `e-${source}-${target}`,
                    source,
                    target,
                    type: 'smoothstep',
                    animated: true
                }));

                return res.json({
                    nodes,
                    edges,
                    diagnoses: [], // Client can refetch or we can populate
                    isGuideline: true
                });
            } else {
                console.log('⚠️ [DiagnosticPathway] No template found, falling back to raw graph filtering');
            }
        }

        // --- FALLBACK (Raw Graph Logic) ---

        // 1. Fetch all clinical events for patient
        const { data: events, error: eventsError } = await supabase
            .from('clinical_events')
            .select('id, event_type, event_name, event_date, confidence, metadata, source_report_id')
            .eq('patient_id', patientId)
            .order('event_date', { ascending: true });

        if (eventsError) throw eventsError;

        if (!events || events.length === 0) {
            console.log(`ℹ️ [DiagnosticPathway] No events found for patient`);
            return res.json({ nodes: [], edges: [], diagnoses: [] });
        }

        let filteredEventIds = events.map((e: any) => e.id);

        // Raw filtering logic (Legacy)
        if (conditionFilter) {
            const relatedDiagnosis = events.find((e: any) =>
                e.event_type === 'diagnosis' &&
                e.event_name.toLowerCase() === (conditionFilter as string).toLowerCase()
            );
            // Just return full graph for now if template missing
        }

        // 3. Fetch all edges for patient
        const { data: edges, error: edgesError } = await supabase
            .from('clinical_event_edges')
            .select('id, from_event_id, to_event_id, relation_type, confidence')
            .eq('patient_id', patientId);

        if (edgesError) throw edgesError;

        // 4. Transform events to React Flow nodes
        const nodes = events.map((event: any) => ({
            id: event.id,
            data: {
                label: event.event_name,
                type: event.event_type,
                date: event.event_date,
                confidence: event.confidence,
                metadata: event.metadata,
                sourceReportId: event.source_report_id
            },
            position: { x: 0, y: 0 },
            style: getNodeStyle(event.event_type),
            type: 'default'
        }));

        // 5. Transform edges to React Flow edges
        const reactFlowEdges = (edges || [])
            .map((edge: any) => ({
                id: edge.id,
                source: edge.from_event_id,
                target: edge.to_event_id,
                label: edge.relation_type,
                type: 'smoothstep',
                animated: edge.confidence > 0.8,
                style: {
                    stroke: getEdgeColor(edge.relation_type),
                    strokeWidth: edge.confidence * 3
                }
            }));

        // 6. Extract unique diagnoses (for condition pills)
        const diagnoses = events
            .filter((e: any) => e.event_type === 'diagnosis')
            .map((e: any) => ({
                id: e.id,
                name: e.event_name,
                date: e.event_date,
                confidence: e.confidence
            }))
            .filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);

        res.json({
            nodes,
            edges: reactFlowEdges,
            diagnoses,
            isGuideline: false
        });

    } catch (error: any) {
        console.error('❌ [DiagnosticPathway] Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

/**
 * GET /api/diagnostic-pathway/:patientId/diagnoses
 * 
 * Get unique diagnoses for condition filtering pills
 */
router.get('/:patientId/diagnoses', async (req: Request, res: Response) => {
    try {
        const { patientId } = req.params;

        const { data, error } = await supabase
            .from('clinical_events')
            .select('id, event_name, event_date, confidence')
            .eq('patient_id', patientId)
            .eq('event_type', 'diagnosis')
            .order('event_date', { ascending: false });

        if (error) throw error;

        // Deduplicate by name
        const uniqueDiagnoses = Array.from(
            new Map((data || []).map((d: any) => [d.event_name, d])).values()
        );

        res.json(uniqueDiagnoses);
    } catch (error: any) {
        console.error('❌ [DiagnosticPathway] Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

/**
 * GET /api/diagnostic-pathway/:patientId/event/:eventId
 * 
 * Get detailed information about a single event
 */
router.get('/:patientId/event/:eventId', async (req: Request, res: Response) => {
    try {
        const { patientId, eventId } = req.params;

        const { data: event, error: eventError } = await supabase
            .from('clinical_events')
            .select('*')
            .eq('id', eventId)
            .eq('patient_id', patientId)
            .single();

        if (eventError) throw eventError;

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Fetch related report if source_report_id exists
        let relatedReport = null;
        if (event.source_report_id) {
            const { data: report } = await supabase
                .from('parsed_reports')
                .select('id, report_type, parsed_json, created_at')
                .eq('id', event.source_report_id)
                .single();

            relatedReport = report;
        }

        // Fetch connected events (upstream and downstream)
        const { data: incomingEdges } = await supabase
            .from('clinical_event_edges')
            .select('from_event_id, relation_type, clinical_events!from_event_id(event_name, event_type)')
            .eq('to_event_id', eventId);

        const { data: outgoingEdges } = await supabase
            .from('clinical_event_edges')
            .select('to_event_id, relation_type, clinical_events!to_event_id(event_name, event_type)')
            .eq('from_event_id', eventId);

        res.json({
            event,
            relatedReport,
            connectedEvents: {
                incoming: incomingEdges || [],
                outgoing: outgoingEdges || []
            }
        });

    } catch (error: any) {
        console.error('❌ [DiagnosticPathway] Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

/**
 * Node styling by event type
 */
/**
 * Node styling by event type & status
 */
function getNodeStyle(eventType: string, status: string = 'completed') {
    const baseStyles: Record<string, any> = {
        diagnosis: {
            background: '#3b82f6',
            color: '#fff',
            borderColor: '#1e40af',
        },
        lab_result: {
            background: '#a855f7',
            color: '#fff',
            borderColor: '#7e22ce',
        },
        medication: {
            background: '#10b981',
            color: '#fff',
            borderColor: '#059669',
        },
        treatment: {
            background: '#10b981', // Same as med for now
            color: '#fff',
            borderColor: '#059669',
        },
        investigation: {
            background: '#06b6d4',
            color: '#fff',
            borderColor: '#0891b2',
        },
        decision: {
            background: '#64748b',
            color: '#fff',
            borderColor: '#475569',
            borderRadius: '4px', // Decisions often diamonds/rects
            shape: 'rect'
        },
        milestone: {
            background: '#f43f5e',
            color: '#fff',
            borderColor: '#e11d48',
            borderStyle: 'double'
        },
        follow_up: {
            background: '#8b5cf6',
            color: '#fff',
            borderColor: '#7c3aed',
        },
        // Fallbacks...
        symptom: {
            background: '#f59e0b',
            color: '#fff',
            borderColor: '#d97706',
        }
    };

    const typeStyle = baseStyles[eventType] || baseStyles.investigation;

    // Apply status modifiers
    let opacity = 1;
    let borderStyle = 'solid';
    let borderWidth = '2px';

    if (status === 'pending') {
        opacity = 0.5;
        borderStyle = 'dashed';
    } else if (status === 'current') {
        borderWidth = '4px';
        // Add glow effect in CSS if possible, here just thicker border
        typeStyle.borderColor = '#fbbf24'; // Amber glow color
    }

    return {
        background: typeStyle.background,
        color: typeStyle.color,
        border: `${borderWidth} ${borderStyle} ${typeStyle.borderColor}`,
        borderRadius: '12px',
        padding: '12px',
        minWidth: '120px',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        opacity
    };
}

/**
 * Edge color by relation type
 */
function getEdgeColor(relationType: string): string {
    const colors: Record<string, string> = {
        leads_to: '#f59e0b',
        confirms: '#10b981',
        rules_out: '#ef4444',
        followed_by: '#8b5cf6',
        caused_by: '#f59e0b',
        treated_by: '#10b981',
        monitors: '#06b6d4'
    };

    return colors[relationType] || '#6b7280';
}

export default router;
