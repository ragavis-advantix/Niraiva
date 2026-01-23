import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export type RelationType = 'leads_to' | 'confirms' | 'rules_out' | 'followed_by' | 'caused_by' | 'treated_by' | 'monitors';

interface EdgeRule {
    fromType: string;
    toType: string;
    relationType: RelationType;
    priority: number; // Higher priority edges rendered first
}

export class EdgeConstructionService {
    // Causal rules engine
    private edgeRules: EdgeRule[] = [
        // Symptom leads to Investigation
        { fromType: 'symptom', toType: 'investigation', relationType: 'leads_to', priority: 10 },

        // Investigation confirms Diagnosis
        { fromType: 'investigation', toType: 'diagnosis', relationType: 'confirms', priority: 9 },

        // Lab result leads to Diagnosis
        { fromType: 'lab_result', toType: 'diagnosis', relationType: 'confirms', priority: 8 },

        // Diagnosis leads to Treatment
        { fromType: 'diagnosis', toType: 'treatment', relationType: 'leads_to', priority: 7 },

        // Diagnosis treated by Medication
        { fromType: 'diagnosis', toType: 'medication', relationType: 'treated_by', priority: 7 },

        // Diagnosis followed by Follow-up
        { fromType: 'diagnosis', toType: 'follow_up', relationType: 'followed_by', priority: 6 },

        // Medication monitored by Follow-up
        { fromType: 'medication', toType: 'follow_up', relationType: 'monitors', priority: 5 },

        // Treatment followed by Follow-up
        { fromType: 'treatment', toType: 'follow_up', relationType: 'followed_by', priority: 5 }
    ];

    /**
     * Construct edges based on event types and temporal proximity
     * Rules: Symptom → Investigation → Diagnosis → Treatment/Medication → Follow-up
     */
    async constructEdges(patientId: string, newEventIds?: string[]): Promise<string[]> {
        console.log(`🔗 [EdgeConstruction] Building edges for patient ${patientId}`);

        const createdEdgeIds: string[] = [];

        // Fetch all events for this patient
        const { data: allEvents, error: eventsError } = await supabase
            .from('clinical_events')
            .select('id, event_type, event_name, event_date, confidence')
            .eq('patient_id', patientId)
            .order('event_date', { ascending: true });

        if (eventsError) {
            console.error(`❌ [EdgeConstruction] Failed to fetch events:`, eventsError);
            return [];
        }

        if (!allEvents || allEvents.length === 0) {
            console.log(`⚠️ [EdgeConstruction] No events found for patient`);
            return [];
        }

        console.log(`📦 [EdgeConstruction] Found ${allEvents.length} events to link`);

        // For each rule, find matching event pairs
        for (const rule of this.edgeRules) {
            const fromEvents = allEvents.filter(e => e.event_type === rule.fromType);
            const toEvents = allEvents.filter(e => e.event_type === rule.toType);

            console.log(`  Applying rule: ${rule.fromType} → ${rule.toType} (${rule.relationType})`);
            console.log(`    From: ${fromEvents.length} events, To: ${toEvents.length} events`);

            // Match events by temporal proximity
            for (const fromEvent of fromEvents) {
                for (const toEvent of toEvents) {
                    // Only create edges forward in time
                    if (!fromEvent.event_date || !toEvent.event_date) continue;
                    if (new Date(fromEvent.event_date) > new Date(toEvent.event_date)) continue;

                    // Calculate temporal proximity (prefer same report date or close dates)
                    const daysDiff = Math.abs(
                        (new Date(toEvent.event_date).getTime() - new Date(fromEvent.event_date).getTime()) /
                        (1000 * 60 * 60 * 24)
                    );

                    // Only create edge if within 365 days (reasonable clinical window)
                    if (daysDiff > 365) continue;

                    // Confidence decreases with temporal distance
                    const confidenceDecay = Math.max(0.5, 1 - daysDiff / 365);
                    const edgeConfidence = rule.priority / 10 * confidenceDecay;

                    try {
                        const { data, error } = await supabase
                            .from('clinical_event_edges')
                            .insert({
                                id: uuidv4(),
                                patient_id: patientId,
                                from_event_id: fromEvent.id,
                                to_event_id: toEvent.id,
                                relation_type: rule.relationType,
                                confidence: edgeConfidence
                            })
                            .select('id');

                        if (error) {
                            if (error.code !== '23505') { // Ignore UNIQUE constraint violations
                                console.warn(`⚠️ [EdgeConstruction] Error creating edge: ${error.message}`);
                            }
                        } else if (data && data.length > 0) {
                            createdEdgeIds.push(data[0].id);
                            console.log(`    ✓ ${fromEvent.event_name} → ${toEvent.event_name}`);
                        }
                    } catch (e) {
                        console.error(`❌ [EdgeConstruction] Failed to create edge:`, e);
                    }
                }
            }
        }

        console.log(`✅ [EdgeConstruction] Created ${createdEdgeIds.length} edges`);
        return createdEdgeIds;
    }

    /**
     * Remove edges when a report is deleted (cleanup)
     */
    async removeEdgesForReport(reportId: string): Promise<number> {
        console.log(`🗑️ [EdgeConstruction] Removing edges from deleted report ${reportId}`);

        // Find events from this report
        const { data: reportEvents, error: fetchError } = await supabase
            .from('clinical_events')
            .select('id')
            .eq('source_report_id', reportId);

        if (fetchError) {
            console.error(`❌ [EdgeConstruction] Failed to fetch report events:`, fetchError);
            return 0;
        }

        const eventIds = reportEvents?.map((e: any) => e.id) || [];

        if (eventIds.length === 0) {
            return 0;
        }

        // Remove edges involving these events
        const { error: deleteError, data } = await supabase
            .from('clinical_event_edges')
            .delete()
            .or(`from_event_id.in.(${eventIds.join(',')}),to_event_id.in.(${eventIds.join(',')})`);

        if (deleteError) {
            console.error(`❌ [EdgeConstruction] Failed to delete edges:`, deleteError);
            return 0;
        }

        console.log(`✅ [EdgeConstruction] Cleaned up edges for deleted report`);
        return eventIds.length;
    }
}

export const edgeConstructionService = new EdgeConstructionService();
