
export type PathwayStepType =
    | 'investigation'
    | 'decision'
    | 'treatment'
    | 'follow_up';

export interface PathwayStep {
    id: string;
    label: string;
    type: PathwayStepType;
}

export interface ConditionPathway {
    condition: string;
    steps: PathwayStep[];
    edges: [string, string][];
}

export const CONDITION_PATHWAYS: Record<string, ConditionPathway> = {
    Hyperlipidemia: {
        condition: 'Hyperlipidemia',
        steps: [
            { id: 'lipid', label: 'Initial Lipid Panel', type: 'investigation' },
            { id: 'risk', label: 'ASCVD Risk Stratification', type: 'decision' },
            { id: 'low', label: 'Low Risk', type: 'decision' },
            { id: 'moderate', label: 'Moderate Risk', type: 'decision' },
            { id: 'high', label: 'High Risk', type: 'decision' },
            { id: 'lifestyle', label: 'Lifestyle Interventions', type: 'treatment' },
            { id: 'statin', label: 'Statin Therapy', type: 'treatment' },
            { id: 'monitor', label: 'Monitor Liver Function', type: 'follow_up' }
        ],
        edges: [
            ['lipid', 'risk'],
            ['risk', 'low'],
            ['risk', 'moderate'],
            ['risk', 'high'],
            ['low', 'lifestyle'],
            ['moderate', 'statin'],
            ['high', 'statin'],
            ['statin', 'monitor']
        ]
    },
    'Type 2 Diabetes': {
        condition: 'Type 2 Diabetes',
        steps: [
            { id: 'screening', label: 'Screening (HbA1c / FPG)', type: 'investigation' },
            { id: 'diagnosis_confirmed', label: 'Diagnosis Confirmed', type: 'decision' },
            { id: 'lifestyle_metformin', label: 'Lifestyle + Metformin', type: 'treatment' },
            { id: 'monitor_3mo', label: '3-Month Assessment', type: 'investigation' },
            { id: 'intensification', label: 'Treatment Intensification', type: 'decision' },
            { id: 'add_agent', label: 'Add Second Agent', type: 'treatment' }
        ],
        edges: [
            ['screening', 'diagnosis_confirmed'],
            ['diagnosis_confirmed', 'lifestyle_metformin'],
            ['lifestyle_metformin', 'monitor_3mo'],
            ['monitor_3mo', 'intensification'],
            ['intensification', 'add_agent']
        ]
    },
    Hypertension: {
        condition: 'Hypertension',
        steps: [
            { id: 'bp_check', label: 'Initial BP Check', type: 'investigation' },
            { id: 'diagnosis', label: 'Confirm Diagnosis', type: 'decision' },
            { id: 'non_pharm', label: 'Non-Pharmacologic Therapy', type: 'treatment' },
            { id: 'stage_1_meds', label: 'Stage 1 Meds (if high risk)', type: 'treatment' },
            { id: 'reassess_1mo', label: 'Reassess in 1 Month', type: 'follow_up' }
        ],
        edges: [
            ['bp_check', 'diagnosis'],
            ['diagnosis', 'non_pharm'],
            ['non_pharm', 'reassess_1mo'],
            ['diagnosis', 'stage_1_meds'],
            ['stage_1_meds', 'reassess_1mo']
        ]
    }
};
