
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
        // Basic fuzzy matching
        const match = events.find(e =>
            e.event_name?.toLowerCase().includes(step.label.toLowerCase()) ||
            (step.label.toLowerCase().includes('lipid') && e.event_name?.toLowerCase().includes('cholesterol')) || // Simple alias
            (step.label.toLowerCase().includes('statin') && e.event_name?.toLowerCase().includes('statin'))
        );

        return {
            ...step,
            status: match ? 'completed' : 'pending'
        };
    });
}
