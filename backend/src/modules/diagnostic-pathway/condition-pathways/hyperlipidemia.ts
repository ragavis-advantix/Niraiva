
export interface PathwayStep {
    id: string;
    label: string;
    type: 'investigation' | 'decision' | 'treatment' | 'follow_up' | 'milestone';
    next?: string | string[]; // Single next step or array for branching
    status?: 'pending' | 'completed' | 'current' | 'warning';
    description?: string;
    criteria?: string[]; // Keywords to match against clinical events
}

export interface ConditionPathway {
    condition: string;
    steps: PathwayStep[];
    edges: [string, string][]; // [sourceId, targetId]
}

export const HyperlipidemiaPathway: ConditionPathway = {
    condition: 'Hyperlipidemia',
    steps: [
        {
            id: 'lipid_panel',
            label: 'Initial Lipid Panel',
            type: 'investigation',
            description: 'Baseline measurement of Cholesterol, LDL, HDL, Triglycerides',
            criteria: ['lipid panel', 'cholesterol', 'ldl', 'hdl', 'triglycerides']
        },
        {
            id: 'risk_strat',
            label: 'ASCVD Risk Stratification',
            type: 'decision',
            description: 'Assess 10-year risk of heart disease or stroke',
            criteria: ['ascvd', 'risk', 'score', 'risk assessment']
        },
        {
            id: 'lifestyle',
            label: 'Lifestyle Modifications',
            type: 'treatment',
            description: 'Diet, exercise, and weight management',
            criteria: ['diet', 'exercise', 'lifestyle', 'weight loss']
        },
        {
            id: 'statin',
            label: 'Statin Therapy',
            type: 'treatment',
            description: 'Initiate statin medication if risk is elevated',
            criteria: ['statin', 'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin']
        },
        {
            id: 'recheck_lipid',
            label: 'Follow-up Lipid Panel',
            type: 'investigation',
            description: 'Recheck lipids 4-12 weeks after initiation',
            criteria: ['lipid panel follow-up', 'recheck lipids']
        },
        {
            id: 'target_achieved',
            label: 'Target LDL Achieved',
            type: 'milestone',
            description: 'LDL-C < 70 mg/dL (or < 55 mg/dL for high risk)',
            criteria: ['target achieved', 'controlled']
        }
    ],
    edges: [
        ['lipid_panel', 'risk_strat'],
        ['risk_strat', 'lifestyle'],
        ['risk_strat', 'statin'],
        ['lifestyle', 'recheck_lipid'],
        ['statin', 'recheck_lipid'],
        ['recheck_lipid', 'target_achieved']
    ]
};
