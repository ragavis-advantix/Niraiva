
import { ConditionPathway } from './hyperlipidemia';

export const Type2DiabetesPathway: ConditionPathway = {
    condition: 'Type 2 Diabetes',
    steps: [
        {
            id: 'screening',
            label: 'Screening (HbA1c / FPG)',
            type: 'investigation',
            description: 'HbA1c ≥ 6.5% or FPG ≥ 126 mg/dL confirms diagnosis',
            criteria: ['hba1c', 'hemoglobin a1c', 'fasting plasma glucose', 'glucose']
        },
        {
            id: 'diagnosis_confirmed',
            label: 'Diagnosis Confirmed',
            type: 'decision',
            description: 'Clinical confirmation of Type 2 Diabetes',
            criteria: ['diabetes', 'type 2 dm', 't2dm']
        },
        {
            id: 'lifestyle_metformin',
            label: 'Lifestyle + Metformin',
            type: 'treatment',
            description: 'First-line therapy: Diet, exercise, and Metformin',
            criteria: ['metformin', 'lifestyle', 'diet']
        },
        {
            id: 'monitor_3mo',
            label: '3-Month Assessment',
            type: 'investigation',
            description: 'Recheck HbA1c to assess glycemic control',
            criteria: ['hba1c follow-up', '3 month check']
        },
        {
            id: 'intensification',
            label: 'Treatment Intensification',
            type: 'decision',
            description: 'Add second agent if HbA1c not at target',
            criteria: ['uncontrolled', 'intensify', 'add medication']
        },
        {
            id: 'add_agent',
            label: 'Add Second Agent',
            type: 'treatment',
            description: 'GLP-1 RA, SGLT2i, or DPP-4i',
            criteria: ['glp-1', 'sglt2', 'sitagliptin', 'empagliflozin', 'semaglutide']
        }
    ],
    edges: [
        ['screening', 'diagnosis_confirmed'],
        ['diagnosis_confirmed', 'lifestyle_metformin'],
        ['lifestyle_metformin', 'monitor_3mo'],
        ['monitor_3mo', 'intensification'],
        ['intensification', 'add_agent']
    ]
};
