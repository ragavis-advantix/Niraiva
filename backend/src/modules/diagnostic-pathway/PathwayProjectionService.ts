
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
        // We fetch ALL events to match against criteria
        const { data: events, error } = await supabase
            .from('clinical_events')
            .select('*')
            .eq('patient_id', patientId)
            .order('event_date', { ascending: true });

        if (error || !events) {
            console.error('❌ [PathwayProjection] Failed to fetch events', error);
            return null;
        }

        // 3. Map steps to status
        const projectedSteps = template.steps.map(step => {
            // Find ALL matching events for this step
            const matches = events.filter(e => {
                const name = normalize(e.event_name);
                // Check if event name matches any criteria keyword
                return step.criteria?.some(keyword => name.includes(normalize(keyword)));
            });

            // Determine status
            let status: PathwayStep['status'] = 'pending';
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
                status,
                matchedEvent: usageEvent, // Attach actual patient data
                allMatches: matches
            };
        });

        // 4. Determine 'current' step (first pending one)
        const firstPendingIndex = projectedSteps.findIndex(s => s.status === 'pending');
        if (firstPendingIndex !== -1) {
            projectedSteps[firstPendingIndex].status = 'current';
        }

        return {
            condition: template.condition,
            steps: projectedSteps,
            edges: template.edges
        };
    }
}

export const pathwayProjectionService = new PathwayProjectionService();
