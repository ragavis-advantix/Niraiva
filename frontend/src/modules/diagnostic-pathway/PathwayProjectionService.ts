
export interface ClinicalEvent {
    id: string;
    event_name: string;
    event_type: string;
    event_date?: string;
    metadata?: any;
}

export interface ProjectedStep {
    id: string;
    label: string;
    type: string;
    status: 'completed' | 'pending';
}

export function projectPathway(
    steps: any[],
    events: ClinicalEvent[]
): ProjectedStep[] {
    return steps.map(step => {
        // First try basic fuzzy matching on event names
        let match = events.find(e =>
            e.event_name?.toLowerCase().includes(step.label.toLowerCase()) ||
            (step.label.toLowerCase().includes('lipid') && e.event_name?.toLowerCase().includes('cholesterol')) || // Simple alias
            (step.label.toLowerCase().includes('statin') && e.event_name?.toLowerCase().includes('statin'))
        );

        // If no match on event names, try to match based on extracted data from health_reports
        if (!match && events.length > 0) {
            const healthReportEvents = events.filter(e => e.metadata?.source === 'health_reports');
            for (const event of healthReportEvents) {
                const conditions = event.metadata?.conditions || [];
                const parameters = event.metadata?.parameters || [];
                const medications = event.metadata?.medications || [];

                // Check if the step can be matched with the extracted data
                const stepLower = step.label.toLowerCase();
                const stepId = step.id?.toLowerCase() || '';

                // Match investigation steps with parameters
                if ((stepLower.includes('screening') || stepLower.includes('hba1c') || stepLower.includes('fpg') ||
                    stepId.includes('screening')) &&
                    parameters.some(p => p.name?.toLowerCase().includes('hba1c') || p.name?.toLowerCase().includes('glucose'))) {
                    match = event;
                    break;
                }

                // Match treatment steps with medications
                if ((stepLower.includes('metformin') || stepId.includes('lifestyle_metformin') || stepLower.includes('statin')) &&
                    medications.some(m => m.name?.toLowerCase().includes('metformin') || m.name?.toLowerCase().includes('statin'))) {
                    match = event;
                    break;
                }

                // Match diagnosis confirmation if we have relevant conditions
                if ((stepLower.includes('diagnosis') || stepId.includes('diagnosis')) &&
                    conditions.some(c => c.name?.toLowerCase().includes('diabetes') ||
                        c.name?.toLowerCase().includes('hypertension') ||
                        c.name?.toLowerCase().includes('hyperlipidemia'))) {
                    match = event;
                    break;
                }

                // If we have a health report with extracted data, mark most steps as having some evidence
                if (event.metadata?.conditions?.length > 0 ||
                    event.metadata?.parameters?.length > 0 ||
                    event.metadata?.medications?.length > 0) {
                    // For now, mark as pending but with some data context
                    // This allows the visualization to show that data exists
                }
            }
        }
        return {
            ...step,
            status: match ? 'completed' : 'pending'
        };
    });
}