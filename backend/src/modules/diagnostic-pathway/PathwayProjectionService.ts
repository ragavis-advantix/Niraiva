
import { ConditionPathway, PathwayStep } from './condition-pathways/hyperlipidemia';
import { HyperlipidemiaPathway } from './condition-pathways/hyperlipidemia';
import { Type2DiabetesPathway } from './condition-pathways/type2diabetes';
import { HypertensionPathway } from './condition-pathways/hypertension';

import { supabase } from '../../lib/supabase';

// Helper to normalize strings for comparison
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export class PathwayProjectionService {

    private getTemplate(condition: string): ConditionPathway | null {
        const normCond = normalize(condition);
        if (normCond.includes('hyperlipidemia') || normCond.includes('cholesterol')) return HyperlipidemiaPathway;
        if (normCond.includes('diabetes')) return Type2DiabetesPathway;
        if (normCond.includes('hypertension') || normCond.includes('bloodpressure')) return HypertensionPathway;
        return null;
    }

    /**
     * Projects patient events onto a static guideline pathway
     */
    async projectPathway(patientId: string, conditionName: string) {
        // 1. Get the template
        const template = this.getTemplate(conditionName);
        if (!template) {
            console.warn(`⚠️ [PathwayProjection] No template found for condition: ${conditionName}`);
            return null; // Or return a generic/default graph
        }

        console.log(`🚀 [PathwayProjection] Projecting ${patientId} onto ${template.condition}`);

        // 2. Fetch all relevant events for this patient
        // Try clinical_events first, fallback to health_reports
        let { data: events, error } = await supabase
            .from('clinical_events')
            .select('*')
            .eq('patient_id', patientId)
            .order('event_date', { ascending: true });

        if (error || !events || events.length === 0) {
            console.log('⚠️ [PathwayProjection] No clinical_events found, fetching from health_reports...');

            // Fallback: Extract events from health_reports
            const { data: reports, error: reportsError } = await supabase
                .from('health_reports')
                .select('report_json, uploaded_at')
                .eq('user_id', patientId)
                .order('uploaded_at', { ascending: true });

            if (reportsError || !reports || reports.length === 0) {
                console.error('❌ [PathwayProjection] Failed to fetch health_reports', reportsError);
                return null;
            }

            events = [];
            const eventSet = new Set<string>();

            // Convert health_reports to event-like structure
            reports.forEach((report) => {
                if (!report.report_json || !report.report_json.data) return;

                const reportData = report.report_json.data;

                // Extract conditions as diagnosis events
                if (Array.isArray(reportData.conditions)) {
                    reportData.conditions.forEach((cond: any) => {
                        const condName = cond.name || cond.diagnosis;
                        const eventKey = `diagnosis-${condName}`;
                        if (condName && !eventSet.has(eventKey)) {
                            eventSet.add(eventKey);
                            events.push({
                                id: eventKey,
                                event_type: 'diagnosis',
                                event_name: condName,
                                event_date: report.uploaded_at,
                                confidence: cond.confidence || 0.9,
                                metadata: { severity: cond.severity || 'moderate' }
                            });
                        }
                    });
                }

                // Extract parameters as test events
                if (Array.isArray(reportData.parameters)) {
                    reportData.parameters.forEach((param: any) => {
                        const paramName = param.name || param.test;
                        const eventKey = `test-${paramName}`;
                        if (paramName && !eventSet.has(eventKey)) {
                            eventSet.add(eventKey);
                            events.push({
                                id: eventKey,
                                event_type: 'test',
                                event_name: paramName,
                                event_date: report.uploaded_at,
                                confidence: 0.95,
                                metadata: {
                                    value: param.value,
                                    unit: param.unit,
                                    status: param.status || 'normal'
                                }
                            });
                        }
                    });
                }

                // Extract medications as medication events
                if (Array.isArray(reportData.medications)) {
                    reportData.medications.forEach((med: any) => {
                        if (med.name) {
                            const eventKey = `medication-${med.name}`;
                            if (!eventSet.has(eventKey)) {
                                eventSet.add(eventKey);
                                events.push({
                                    id: eventKey,
                                    event_type: 'medication',
                                    event_name: med.name,
                                    event_date: report.uploaded_at,
                                    confidence: 0.95,
                                    metadata: {
                                        dose: med.dose,
                                        frequency: med.frequency,
                                        status: med.status || 'active'
                                    }
                                });
                            }
                        }
                    });
                }
            });

            if (events.length === 0) {
                console.log('⚠️ [PathwayProjection] No extractable events from health reports');
                return null;
            }

            console.log(`✅ [PathwayProjection] Extracted ${events.length} events from health_reports`);
        }

        // 3. Map steps to status
        const projectedSteps = template.steps.map((step: PathwayStep) => {
            // Find ALL matching events for this step
            const matches = events.filter(e => {
                const name = normalize(e.event_name);
                // Check if event name matches any criteria keyword
                return step.criteria?.some(keyword => name.includes(normalize(keyword)));
            });

            // Determine status
            let status: 'pending' | 'completed' | 'current' | 'warning' = 'pending';
            let usageEvent = null;

            if (matches.length > 0) {
                status = 'completed'; // Default behavior: if event exists, step is done

                // Refined logic:
                // - Medications: 'current' if recently started? (Simple logic: completed)
                // - Decisions: 'completed'

                // Use the most recent event as the primary evidence
                usageEvent = matches[matches.length - 1];
            } else {
                // Check if it should be 'current' flow?
                // Simple logic for now: first pending step is 'current'
            }

            return {
                ...step,
                status: status as 'pending' | 'completed' | 'current' | 'warning',
                matchedEvent: usageEvent, // Attach actual patient data
                allMatches: matches
            };
        });

        // 4. Determine 'current' step (first pending one)
        const firstPendingIndex = projectedSteps.findIndex(s => s.status === 'pending');
        if (firstPendingIndex !== -1) {
            projectedSteps[firstPendingIndex] = {
                ...projectedSteps[firstPendingIndex],
                status: 'current' as const
            };
        }

        return {
            condition: template.condition,
            steps: projectedSteps,
            edges: template.edges
        };
    }
}

export const pathwayProjectionService = new PathwayProjectionService();
