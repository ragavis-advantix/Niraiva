import { timelineRepository } from './timeline.repository';
import { clinicalParametersRepository } from './clinical-parameters.repository';
import { parameterTrendsRepository } from './parameter-trends.repository';

export const timelineService = {
    /**
     * Get patient timeline
     */
    async getPatientTimeline(patientId: string, limit: number = 50, offset: number = 0) {
        return await timelineRepository.findByPatientId(patientId, limit, offset);
    },

    /**
     * Get event details with clinical parameters and trends
     */
    async getEventDetails(eventId: string, patientId: string) {
        const event = await timelineRepository.findById(eventId);
        console.log('Timeline event:', JSON.stringify(event, null, 2));

        if (!event || event.patient_id !== patientId) {
            throw new Error('Event not found or unauthorized access');
        }

        // First try to fetch from health_parameters table
        let parameters = await clinicalParametersRepository.findByEventId(eventId);
        console.log('Parameters from health_parameters table:', parameters);

        // If no parameters in health_parameters, try to extract from medical_records
        if (!parameters || parameters.length === 0) {
            console.log('No parameters in health_parameters, extracting from medical_records...');
            parameters = await this.extractParametersFromMedicalRecord(event);
            console.log('Extracted parameters:', parameters);
        }

        // Fetch trends for these parameters
        const trendsData: any[] = [];
        for (const param of parameters) {
            const trend = await parameterTrendsRepository.findByEventAndParameter(eventId, param.parameter_code);
            if (trend) {
                trendsData.push(trend);
            }
        }

        return {
            event,
            parameters,
            trends: trendsData
        };
    },

    /**
     * Extract parameters from medical record metadata
     */
    async extractParametersFromMedicalRecord(event: any) {
        try {
            // Get the medical record from reference_id
            const { supabase } = await import('../../lib/supabase');

            const { data: record, error } = await supabase
                .from('medical_records')
                .select('data')
                .eq('id', event.reference_id)
                .single();

            if (error || !record) {
                console.error('Medical record not found:', event.reference_id, error);
                return [];
            }

            console.log('Medical record data structure:', JSON.stringify(record, null, 2));

            const recordData = record.data;
            console.log('Record data:', recordData);

            // Try multiple paths where parameters might be stored
            let parameters: any[] = [];

            if (recordData?.data?.parameters) {
                parameters = recordData.data.parameters;
            } else if (recordData?.parameters) {
                parameters = recordData.parameters;
            } else if (recordData?.results) {
                // For lab reports, results might be the parameters
                parameters = Array.isArray(recordData.results) ? recordData.results : [];
            } else {
                console.warn('No parameters found in medical record:', recordData);
                return [];
            }

            // Transform parameters from medical record format to health_parameters format
            return parameters.map((param: any) => ({
                id: `${event.id}-${param.name}`,
                timeline_event_id: event.id,
                parameter_name: param.name,
                parameter_code: param.name.toLowerCase().replace(/\s+/g, '_'),
                value: String(param.value),
                unit: param.unit,
                normal_range_min: null,
                normal_range_max: null,
                interpretation: param.status || 'normal',
                created_at: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Error extracting parameters from medical record:', error);
            return [];
        }
    },

    /**
     * Create timeline event from medical record
     */
    async createEventFromMedicalRecord(record: any) {
        const eventType = this.getEventTypeFromRecordType(record.record_type);
        const source = record.source || 'Clinical Record';
        const status = record.locked ? 'completed' : 'pending';

        const event = await timelineRepository.create({
            patient_id: record.patient_id,
            event_type: eventType,
            reference_table: 'medical_records',
            reference_id: record.id,
            authority: 'clinical',
            display_priority: this.getPriorityForType(record.record_type),
            event_time: record.created_at,
            status,
            source,
            metadata: {
                record_type: record.record_type,
                source: record.source,
                report_json: record.data
            }
        });

        // Extract and save parameters if it's a lab report
        if (record.record_type === 'lab' && record.data?.results) {
            await this.extractParameters(event.id, record.patient_id, record.data.results);
        }

        return event;
    },

    /**
     * Extract parameters from lab results and compute trends
     */
    async extractParameters(eventId: string, patientId: string, results: any[]) {
        const parameters = results.map(res => ({
            timeline_event_id: eventId,
            parameter_name: res.parameter,
            parameter_code: res.parameter.toLowerCase().replace(/\s+/g, '_'),
            value: String(res.value),
            unit: res.unit,
            normal_range_min: res.range?.split('-')[0],
            normal_range_max: res.range?.split('-')[1],
            interpretation: res.status || 'normal'
        }));

        await clinicalParametersRepository.createMany(parameters);

        // Compute trends for each parameter
        for (const param of parameters) {
            await this.computeTrend(patientId, param.parameter_code, eventId, param.value);
        }
    },

    /**
     * Compute trend for a parameter
     */
    async computeTrend(patientId: string, parameterCode: string, currentEventId: string, currentValue: string) {
        try {
            const latestParam = await clinicalParametersRepository.findLatestForPatient(patientId, parameterCode, currentEventId);

            if (latestParam) {
                const prevValue = parseFloat(latestParam.value);
                const currValue = parseFloat(currentValue);

                let trend: 'improved' | 'stable' | 'worsened' = 'stable';

                if (!isNaN(prevValue) && !isNaN(currValue)) {
                    if (currValue > prevValue) {
                        trend = 'worsened'; // Standard assumption, can be refined based on parameter
                    } else if (currValue < prevValue) {
                        trend = 'improved';
                    }
                }

                await parameterTrendsRepository.create({
                    patient_id: patientId,
                    parameter_code: parameterCode,
                    current_event_id: currentEventId,
                    previous_event_id: latestParam.timeline_event_id,
                    delta_value: String(currValue - prevValue),
                    trend
                });
            }
        } catch (error) {
            console.error(`Error computing trend for ${parameterCode}:`, error);
        }
    },

    /**
     * Create timeline event from personal record
     */
    async createEventFromPersonalRecord(record: any) {
        const eventType = `personal_${record.type}`;

        await timelineRepository.create({
            patient_id: record.patient_id,
            event_type: eventType,
            reference_table: 'personal_records',
            reference_id: record.id,
            authority: 'personal',
            display_priority: 5,
            event_time: record.created_at,
            status: 'completed',
            source: 'Patient Uploaded',
            metadata: {
                type: record.type,
                data: record.data
            }
        });
    },

    /**
     * Get event type from record type
     */
    getEventTypeFromRecordType(recordType: string): string {
        const mapping: Record<string, string> = {
            'lab': 'test',
            'imaging': 'imaging',
            'diagnosis': 'diagnosis',
            'prescription': 'medication',
            'consultation': 'consultation',
            'procedure': 'procedure',
            'vitals': 'vitals'
        };
        return mapping[recordType] || recordType;
    },

    /**
     * Get display priority for record type
     */
    getPriorityForType(recordType: string): number {
        const priorities: Record<string, number> = {
            'diagnosis': 10,
            'prescription': 9,
            'lab': 8,
            'imaging': 7,
            'consultation': 6,
            'procedure': 5,
            'vitals': 4
        };
        return priorities[recordType] || 5;
    }
};

