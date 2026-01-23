
export interface DiagnosticSummary {
    patientName?: string;
    age?: number;
    diagnosisDate?: string;
    severity?: string;
    status?: 'Controlled' | 'Uncontrolled';
}

export interface TreatmentSummary {
    medications: {
        name: string;
        dose?: string;
        frequency?: string;
    }[];
}

export interface ClinicalNote {
    title: string;
    description: string;
}

export interface HealthTrend {
    label: string;
    unit: string;
    points: { date: string; value: number }[];
}

export interface DiagnosticViewModel {
    summary: DiagnosticSummary;
    treatment: TreatmentSummary;
    notes: ClinicalNote[];
    trends: HealthTrend[];
}

export function buildDiagnosticViewModel(
    rawEvents: any[]
): DiagnosticViewModel {
    // Deduplicate events based on name, date, and generic type
    // We prefer events with more metadata if duplicates exist
    const uniqueMap = new Map();

    rawEvents.forEach(e => {
        // Create a unique key for the event
        // Using date + name ensures we don't treat different events on same day as dupes, 
        // nor same event on different days
        const dateStr = e.event_date ? new Date(e.event_date).toISOString().split('T')[0] : 'no-date';
        const key = `${e.event_name?.toLowerCase().trim()}|${dateStr}`;

        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, e);
        } else {
            // detailed logic: keep the one with more metadata keys if available
            const existing = uniqueMap.get(key);
            const existingKeys = existing.metadata ? Object.keys(existing.metadata).length : 0;
            const newKeys = e.metadata ? Object.keys(e.metadata).length : 0;

            if (newKeys > existingKeys) {
                uniqueMap.set(key, e);
            }
        }
    });

    const events = Array.from(uniqueMap.values());

    const diagnoses = events.filter(e => e.event_type === 'diagnosis');
    const labs = events.filter(e => e.event_type === 'lab_result');
    const meds = events.filter(e => e.event_type === 'medication' || e.event_type === 'treatment');

    /* ---------- PATIENT SUMMARY ---------- */

    const primaryDiagnosis = diagnoses[0]; // Simplification

    const diagnosisDate = primaryDiagnosis?.event_date && new Date(primaryDiagnosis.event_date).toLocaleDateString();

    const severity =
        primaryDiagnosis?.metadata?.severity || 'Unknown';

    // Sort labs by date for trend analysis
    const sortedLabs = [...labs].sort((a, b) =>
        new Date(a.event_date || 0).getTime() - new Date(b.event_date || 0).getTime()
    );

    const latestLDL = sortedLabs
        .filter(l => l.metadata?.test === 'LDL' || l.event_name.includes('LDL'))
        .at(-1)?.metadata?.value;

    const status =
        latestLDL !== undefined && Number(latestLDL) < 130
            ? 'Controlled'
            : 'Uncontrolled';

    /* ---------- CURRENT TREATMENT ---------- */

    // Assume active unless specified 'discontinued'
    const activeMedications = meds.filter(
        m => m.metadata?.status !== 'discontinued'
    );

    /* ---------- CLINICAL NOTES ---------- */

    const notes: ClinicalNote[] = [];

    if (latestLDL) {
        notes.push({
            title: 'Recent Progress',
            description:
                Number(latestLDL) < 130
                    ? `LDL reduced to ${latestLDL} mg/dL.`
                    : `LDL remains elevated at ${latestLDL} mg/dL.`
        });
    }

    if (activeMedications.length > 0) {
        notes.push({
            title: 'Current Therapy',
            description: `Patient on ${activeMedications
                .map(m => m.event_name)
                .join(', ')}.`
        });
    }

    /* ---------- HEALTH TRENDS ---------- */

    const ldlTrend: HealthTrend = {
        label: 'LDL Cholesterol',
        unit: 'mg/dL',
        points: sortedLabs
            .filter(l => l.metadata?.test === 'LDL' || l.event_name.includes('LDL'))
            .map(l => ({
                date: new Date(l.event_date || 0).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                value: Number(l.metadata.value || 0)
            }))
    };

    const weightTrend: HealthTrend = {
        label: 'Weight',
        unit: 'kg',
        points: sortedLabs
            .filter(l => l.metadata?.test === 'Weight' || l.event_name.includes('Weight'))
            .map(l => ({
                date: new Date(l.event_date || 0).toLocaleDateString(),
                value: Number(l.metadata.value || 0)
            }))
    };

    return {
        summary: {
            diagnosisDate: diagnosisDate || 'N/A',
            severity,
            status
        },
        treatment: {
            medications: activeMedications.map(m => ({
                name: m.event_name,
                dose: m.metadata?.dose,
                frequency: m.metadata?.frequency
            }))
        },
        notes,
        trends: [ldlTrend, weightTrend].filter(
            t => t.points.length > 0
        )
    };
}
