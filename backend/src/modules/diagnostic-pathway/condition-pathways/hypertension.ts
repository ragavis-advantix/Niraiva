
import { ConditionPathway } from './hyperlipidemia';

export const HypertensionPathway: ConditionPathway = {
    condition: 'Hypertension',
    steps: [
        {
            id: 'bp_monitoring',
            label: 'Blood Pressure Monitoring',
            type: 'investigation',
            description: 'Baseline BP measurement (systolic ≥ 140 or diastolic ≥ 90 mmHg)',
            criteria: ['blood pressure', 'bp', 'hypertension', 'elevated bp']
        },
        {
            id: 'diagnosis_confirmed',
            label: 'Hypertension Diagnosis Confirmed',
            type: 'decision',
            description: 'Clinical confirmation of hypertension based on BP readings',
            criteria: ['hypertension confirmed', 'high blood pressure', 'htn']
        },
        {
            id: 'cardiovascular_assessment',
            label: 'Cardiovascular Risk Assessment',
            type: 'investigation',
            description: 'Assess for target organ damage and cardiovascular risk factors',
            criteria: ['cardiovascular assessment', 'organ damage', 'risk assessment']
        },
        {
            id: 'lifestyle_modifications',
            label: 'Lifestyle Modifications',
            type: 'treatment',
            description: 'DASH diet, sodium reduction, exercise, weight loss, stress management',
            criteria: ['lifestyle', 'diet', 'exercise', 'weight loss', 'sodium reduction']
        },
        {
            id: 'antihypertensive_therapy',
            label: 'Antihypertensive Medication',
            type: 'treatment',
            description: 'First-line agents: ACE inhibitors, ARBs, CCBs, or Thiazide diuretics',
            criteria: ['antihypertensive', 'ace inhibitor', 'arb', 'ccb', 'diuretic', 'lisinopril', 'losartan', 'amlodipine']
        },
        {
            id: 'bp_follow_up',
            label: '4-6 Week Follow-up',
            type: 'investigation',
            description: 'Recheck BP to assess response to therapy',
            criteria: ['follow-up', 'recheck', '4 week', '6 week']
        },
        {
            id: 'dose_adjustment',
            label: 'Dose Adjustment',
            type: 'decision',
            description: 'Titrate medication if BP control inadequate',
            criteria: ['titrate', 'adjust dose', 'increase dose', 'uncontrolled']
        },
        {
            id: 'combination_therapy',
            label: 'Combination Therapy',
            type: 'treatment',
            description: 'Add second agent if monotherapy insufficient',
            criteria: ['combination', 'dual therapy', 'add agent']
        },
        {
            id: 'target_bp_achieved',
            label: 'Target BP Achieved',
            type: 'milestone',
            description: 'BP at goal (<130/80 mmHg)',
            criteria: ['target achieved', 'bp goal', 'controlled hypertension']
        },
        {
            id: 'long_term_monitoring',
            label: 'Long-term Monitoring',
            type: 'follow_up',
            description: 'Continue medication and monitor for complications',
            criteria: ['monitoring', 'long-term follow-up', 'maintenance']
        }
    ],
    edges: [
        ['bp_monitoring', 'diagnosis_confirmed'],
        ['diagnosis_confirmed', 'cardiovascular_assessment'],
        ['cardiovascular_assessment', 'lifestyle_modifications'],
        ['lifestyle_modifications', 'antihypertensive_therapy'],
        ['antihypertensive_therapy', 'bp_follow_up'],
        ['bp_follow_up', 'dose_adjustment'],
        ['dose_adjustment', 'combination_therapy'],
        ['dose_adjustment', 'target_bp_achieved'],
        ['combination_therapy', 'bp_follow_up'],
        ['target_bp_achieved', 'long_term_monitoring']
    ]
};
