import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface ExtractedEvent {
    event_type: 'symptom' | 'diagnosis' | 'investigation' | 'lab_result' | 'treatment' | 'medication' | 'follow_up';
    event_name: string;
    event_date?: string;
    confidence?: number;
    metadata?: any;
}

export class EventExtractionService {
    /**
     * Extract clinical events from parsed report JSON
     * Handles diagnoses, labs, medications, symptoms, etc.
     */
    async extractEventsFromReport(
        patientId: string,
        reportId: string,
        parsedJson: any
    ): Promise<ExtractedEvent[]> {
        const events: ExtractedEvent[] = [];
        const reportDate = parsedJson.metadata?.documentDate ||
            parsedJson.metadata?.report_date ||
            new Date().toISOString().split('T')[0];

        // Normalize JSON structure (handle wrapped 'data' property)
        const data = parsedJson.data || parsedJson;

        console.log(`📊 [EventExtraction] Processing report ${reportId} for patient ${patientId}`);

        // 1. Extract Diagnoses
        // Check both 'diagnoses' (common) and 'conditions' (from MultiLLM schema)
        const diagnosisSource = data.diagnoses || data.conditions || data.diagnosis;
        if (diagnosisSource && Array.isArray(diagnosisSource)) {
            for (const diagnosis of diagnosisSource) {
                const diagnosisName = typeof diagnosis === 'string' ? diagnosis : diagnosis.name || diagnosis.condition_name;
                if (diagnosisName) {
                    events.push({
                        event_type: 'diagnosis',
                        event_name: diagnosisName,
                        event_date: reportDate,
                        confidence: 0.9,
                        metadata: {
                            source: 'parsed_report',
                            diagnosis_code: diagnosis.code,
                            diagnosis_description: diagnosis.description
                        }
                    });
                }
            }
        }

        // 2. Extract Lab Results (as investigations & lab events)
        // 2. Extract Lab Results (as investigations & lab events)
        if (data.parameters && Array.isArray(data.parameters)) {
            for (const param of data.parameters) {
                const paramName = param.name || param.parameter_name;
                if (!paramName) continue;

                // Lab result event
                events.push({
                    event_type: 'lab_result',
                    event_name: paramName,
                    event_date: reportDate,
                    confidence: 0.95,
                    metadata: {
                        value: param.value,
                        unit: param.unit,
                        status: param.status,
                        normal_range: param.normal_range || param.reference_range
                    }
                });

                // If abnormal, also create investigation marker
                if (param.status === 'high' || param.status === 'low' || param.status === 'abnormal') {
                    events.push({
                        event_type: 'investigation',
                        event_name: `${paramName} Investigation`,
                        event_date: reportDate,
                        confidence: 0.85,
                        metadata: {
                            parameter: paramName,
                            finding: param.status
                        }
                    });
                }
            }
        }

        // 3. Extract Medications
        // 3. Extract Medications
        if (data.medications && Array.isArray(data.medications)) {
            for (const med of data.medications) {
                const medName = typeof med === 'string' ? med : med.name || med.medication_name;
                if (medName) {
                    events.push({
                        event_type: 'medication',
                        event_name: medName,
                        event_date: reportDate,
                        confidence: 0.9,
                        metadata: {
                            dose: med.dose,
                            frequency: med.frequency,
                            route: med.route
                        }
                    });
                }
            }
        }

        // 4. Extract Treatment/Management
        // 4. Extract Treatment/Management
        // Check recommendations, treatment, or plan
        const treatmentSource = data.recommendations || data.treatment || data.plan;
        if (treatmentSource && Array.isArray(treatmentSource)) {
            for (const rec of treatmentSource) {
                const recText = typeof rec === 'string' ? rec : rec.text || rec.recommendation;
                if (recText) {
                    events.push({
                        event_type: 'treatment',
                        event_name: recText,
                        event_date: reportDate,
                        confidence: 0.8,
                        metadata: {
                            recommendation_type: rec.type
                        }
                    });
                }
            }
        }

        // 5. Extract Follow-up instructions
        // 5. Extract Follow-up instructions
        if (data.follow_up && Array.isArray(data.follow_up)) {
            for (const followUp of data.follow_up) {
                const followUpText = typeof followUp === 'string' ? followUp : followUp.text || followUp.instruction;
                if (followUpText) {
                    events.push({
                        event_type: 'follow_up',
                        event_name: followUpText,
                        event_date: reportDate,
                        confidence: 0.85,
                        metadata: {
                            followup_type: followUp.type
                        }
                    });
                }
            }
        }

        console.log(`✅ [EventExtraction] Extracted ${events.length} events from report`);
        return events;
    }

    /**
     * Persist extracted events to database
     * Links each event back to the source report
     */
    async persistEvents(
        patientId: string,
        reportId: string,
        events: ExtractedEvent[]
    ): Promise<string[]> {
        const createdEventIds: string[] = [];

        for (const event of events) {
            try {
                // UNIQUE constraint prevents duplicates (patient, type, name, date)
                const { data, error } = await supabase
                    .from('clinical_events')
                    .insert({
                        id: uuidv4(),
                        patient_id: patientId,
                        event_type: event.event_type,
                        event_name: event.event_name,
                        event_date: event.event_date,
                        source_report_id: reportId,
                        confidence: event.confidence || 1.0,
                        metadata: event.metadata || {}
                    })
                    .select('id');

                if (error) {
                    console.warn(`⚠️ [EventExtraction] Duplicate or error on event ${event.event_name}: ${error.message}`);
                    // Don't fail on duplicates - they're expected
                } else if (data && data.length > 0) {
                    createdEventIds.push(data[0].id);
                    console.log(`  → Created event: ${event.event_name} (${event.event_type})`);
                }
            } catch (e) {
                console.error(`❌ [EventExtraction] Failed to persist event:`, e);
            }
        }

        console.log(`✅ [EventExtraction] Persisted ${createdEventIds.length} events to database`);
        return createdEventIds;
    }

    /**
     * Full pipeline: extract + persist
     */
    async processReportEvents(
        patientId: string,
        reportId: string,
        parsedJson: any
    ): Promise<string[]> {
        const events = await this.extractEventsFromReport(patientId, reportId, parsedJson);
        const eventIds = await this.persistEvents(patientId, reportId, events);
        return eventIds;
    }
}

export const eventExtractionService = new EventExtractionService();
