import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { UserProfile, HealthParameter, TimelineEvent, ChronicCondition } from '@/utils/healthData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/lib/fhir';

type DataShape = {
  userProfile: UserProfile | null;
  healthParameters: HealthParameter[];
  timelineEvents: TimelineEvent[];
  chronicConditions: ChronicCondition[];
  medications: any[];
};

type UpdateInstruction = {
  op: 'add' | 'delete' | 'update';
  section: string;
  value: any;
  key?: string;
};

type DataContextType = DataShape & {
  applyUpdate: (u: UpdateInstruction) => void;
  applyUpdates: (u: UpdateInstruction[]) => void;
  resetData: () => void;
  refreshUserData: () => Promise<void>;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [healthParameters, setHealthParameters] = useState<HealthParameter[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [chronicConditions, setChronicConditions] = useState<ChronicCondition[]>([]);
  const [medications, setMedications] = useState<any[]>([]);

  // Normalize report parameters coming from backend/Gemini into UI-friendly HealthParameter
  const normalizeReportParameters = useCallback((params: any[]) => {
    if (!Array.isArray(params)) return [] as any[];
    return params.map((p: any, idx: number) => {
      const name = p.name || p.parameter || `param-${idx}`;
      const rawValue = p.value ?? p.v ?? null;
      const value = (typeof rawValue === 'number' || typeof rawValue === 'string') ? rawValue : null;
      const unit = p.unit || p.units || null;
      const timestamp = p.lastUpdated || p.timestamp || p.date || new Date().toISOString();
      const rawStatus = (p.status || '').toString().toLowerCase();
      // Normalize status to the allowed set: normal | warning | critical
      let status: any = null;
      if (rawStatus === 'normal' || rawStatus === 'ok' || rawStatus === 'within range') status = 'normal';
      else if (rawStatus === 'warning' || rawStatus === 'elevated' || rawStatus === 'high') status = 'warning';
      else if (rawStatus === 'critical' || rawStatus === 'severe' || rawStatus === 'very high') status = 'critical';
      else status = null;

      const trend = (p.trend || p.lastTrend || '').toString().toLowerCase();
      const recentChange = trend === 'improved' ? 'improved' : (trend === 'worsened' || trend === 'declined' ? 'declined' : (trend === 'stable' ? 'stable' : null));

      return {
        id: p.id || `${name}-${idx}`,
        name,
        value,
        unit,
        status,
        recentChange,
        timestamp,
      } as any;
    });
  }, []);

  const normalizeMedications = useCallback((meds: any[]) => {
    if (!Array.isArray(meds)) return [] as any[];
    return meds.map((m: any, idx: number) => ({
      id: m.id || `${(m.name || 'med')}-${idx}`,
      name: m.name || m.medication || null,
      dosage: m.dosage || m.dose || null,
      frequency: m.frequency || m.schedule || null,
      startDate: m.startDate || m.start_date || m.since || null,
    }));
  }, []);

  // Normalize report conditions into the UI ChronicCondition shape
  const inferRelatedParameters = useCallback((conditionName: string | null) => {
    if (!conditionName) return ['General Health'];
    const nm = conditionName.toString().toLowerCase();
    if (nm.includes('diabetes')) return ['Blood Glucose', 'HbA1c'];
    if (nm.includes('hypertension') || nm.includes('blood pressure')) return ['Blood Pressure'];
    if (nm.includes('lipid') || nm.includes('cholesterol')) return ['Total Cholesterol', 'LDL Cholesterol', 'HDL Cholesterol', 'Triglycerides'];
    if (nm.includes('angina') || nm.includes('heart') || nm.includes('cardio')) return ['Blood Pressure', 'Pulse'];
    return ['General Health'];
  }, []);

  // Exact normalizer requested by user — guarantees no nulls and maps fields
  const normalizeCondition = useCallback((cond: any) => {
    // Try many possible locations for a diagnosis/condition name, including nested arrays and coding objects
    const tryExtractName = (c: any) => {
      if (!c) return null;
      if (typeof c === 'string' && c.trim()) return c.trim();
      const candidates = [
        c.name,
        c.condition,
        c.diagnosis,
        c.diagnosisName,
        c.diagnosis_name,
        c.title,
        c.label,
        c.problem,
        c.problem_name,
        c.displayName,
        c.description,
        c.summary,
        c.note,
        c.notes,
        c.text,
        c.excerpt,
      ];
      for (const v of candidates) {
        if (v && typeof v === 'string' && v.trim()) return v.trim();
      }

      // check for array of diagnoses
      if (Array.isArray(c.diagnoses) && c.diagnoses.length > 0) {
        const d = c.diagnoses[0];
        if (typeof d === 'string' && d.trim()) return d.trim();
        if (d && (d.name || d.label || d.text)) return d.name || d.label || d.text;
      }

      // check FHIR-like code.coding
      if (c.code && Array.isArray(c.code.coding) && c.code.coding.length > 0) {
        const cd = c.code.coding[0];
        if (cd && (cd.display || cd.text)) return cd.display || cd.text;
      }

      // check nested _raw structures
      if (c._raw && typeof c._raw === 'object') return tryExtractName(c._raw);

      return null;
    };

    const extracted = tryExtractName(cond);
    const name = extracted || 'Unknown Condition';

    const severity = (cond && (cond.severity)) || 'moderate';

    const currentStatus = (cond && (cond.currentStatus || cond.status)) || 'controlled';

    const diagnosedDate = (cond && (cond.diagnosedDate || cond.onsetDate || cond.onset_date || cond.diagnosed_date)) || new Date().toISOString();

    const relatedParameters = (cond && Array.isArray(cond.relatedParameters) && cond.relatedParameters.length > 0)
      ? cond.relatedParameters
      : inferRelatedParameters(name);

    return {
      id: (cond && cond.id) || `${name.replace(/\s+/g, '-').toLowerCase()}-${Math.floor(Math.random() * 10000)}`,
      name,
      severity,
      currentStatus,
      diagnosedDate,
      relatedParameters,
      notes: (cond && (cond.notes || cond.note || cond.description || '')) || '',
      _raw: cond || {}
    } as any;
  }, [inferRelatedParameters]);

  const normalizeConditions = useCallback((conds: any[], fallbackDate?: string | null) => {
    if (!Array.isArray(conds)) return [] as any[];
    return conds.map((c: any, idx: number) => {
      // Handle simple string entries
      if (typeof c === 'string') {
        const name = c;
        return {
          id: `${name.replace(/\s+/g, '-').toLowerCase()}-${idx}`,
          name,
          diagnosedDate: null,
          severity: undefined,
          currentStatus: undefined,
          relatedParameters: [],
          _raw: c
        } as any;
      }

      // Try many possible name fields that different reports may use
      const name = c && typeof c === 'object' ? (c.name || c.condition || c.diagnosis || c.diagnosisName || c.diagnosis_name || c.title || c.label || c.problem || c.problem_name) : null;
      const fallbackName = name || (c && (c.displayName || c.description || c.summary)) || null;
      let finalName = fallbackName || null;

      // If still missing, try to extract from notes or free text
      if (!finalName) {
        const textCandidates = [c.notes, c.note, c.description, c.summary, c._raw, c.text, c.excerpt].filter(Boolean).map(String).join('\n');
        const diagMatch = textCandidates.match(/(?:Diagnosis|Diagnosed|Dx|Problem):?\s*([A-Za-z0-9\-\(\)\/, ]{3,200})/i);
        if (diagMatch && diagMatch[1]) finalName = diagMatch[1].trim();
      }

      // Also check for diagnoses array or FHIR-like code.coding entries
      if (!finalName && c && Array.isArray(c.diagnoses) && c.diagnoses.length > 0) {
        const d = c.diagnoses[0];
        if (typeof d === 'string' && d.trim()) finalName = d.trim();
        else if (d && (d.name || d.label || d.text)) finalName = d.name || d.label || d.text;
      }

      if (!finalName && c && c.code && Array.isArray(c.code.coding) && c.code.coding.length > 0) {
        const cd = c.code.coding[0];
        if (cd && (cd.display || cd.text)) finalName = cd.display || cd.text;
      }

      if (!finalName && typeof c === 'object' && Object.keys(c).length === 1) {
        // Single-key object where key is name-like
        finalName = Object.keys(c)[0];
      }

      if (!finalName) finalName = `Condition ${idx + 1}`;
      const id = c.id || `${finalName.replace(/\s+/g, '-').toLowerCase()}-${idx}`;

      // Map severity into allowed enum: mild | moderate | severe. Default to heuristic or 'moderate'.
      const rawSeverity = (c && (c.severity || c.severityLevel || c.level) || '').toString().toLowerCase();
      let severity: any = undefined;
      if (rawSeverity.includes('sev') || rawSeverity === 'severe') severity = 'severe';
      else if (rawSeverity.includes('mod') || rawSeverity === 'moderate') severity = 'moderate';
      else if (rawSeverity.includes('mild') || rawSeverity === 'mild') severity = 'mild';

      // Heuristic: infer severity from diagnosis keywords when severity not provided
      if (!severity && finalName) {
        const nm = finalName.toString().toLowerCase();
        if (nm.includes('diabetes') || nm.includes('angina') || nm.includes('heart')) severity = 'moderate';
        else if (nm.includes('hypertension') || nm.includes('hyperlip') || nm.includes('cholesterol')) severity = 'mild';
        else if (nm.includes('failure') || nm.includes('stroke') || nm.includes('cancer')) severity = 'severe';
      }
      if (!severity) severity = 'moderate';

      // Map status/currentStatus loosely — keep undefined if unknown so UI shows 'N/A'
      const rawStatus = (c.currentStatus || c.status || c.stage || '').toString().toLowerCase();

      let currentStatus: any = undefined;
      if (rawStatus.includes('control') || rawStatus === 'controlled' || rawStatus === 'stable') currentStatus = 'controlled';
      else if (rawStatus.includes('improv') || rawStatus === 'improving') currentStatus = 'improving';
      else if (rawStatus.includes('wors') || rawStatus === 'worsening' || rawStatus === 'unstable') currentStatus = 'worsening';
      else if (rawStatus.includes('uncontrol') || rawStatus === 'uncontrolled') currentStatus = 'uncontrolled';

      // Heuristic: infer currentStatus from name tokens like '(Stable)'
      if (!currentStatus && finalName && /\bstable\b/i.test(finalName)) {
        currentStatus = 'controlled';
      }
      if (!currentStatus) currentStatus = 'controlled';

      const diagnosedDateRaw = c && (c.diagnosedDate || c.diagnosed_date || c.onsetDate || c.onset_date || c.date) || null;
      const diagnosedDate = diagnosedDateRaw || fallbackDate || new Date().toISOString().split('T')[0];
      const relatedParametersRaw = Array.isArray(c && c.relatedParameters) ? c.relatedParameters : (c && (c.related_parameters || c.related) || []);
      const relatedParameters = (relatedParametersRaw && relatedParametersRaw.length > 0) ? relatedParametersRaw : inferRelatedParameters(finalName);
      const notes = (c && (c.notes || c.note || c.description || c.summary)) || '';

      return {
        id,
        name: finalName,
        diagnosedDate,
        severity: severity as any,
        currentStatus: currentStatus as any,
        relatedParameters: relatedParameters,
        notes,
        _raw: c
      } as any;
    });
  }, []);

  // Load chronic conditions for a user
  const loadChronicConditions = useCallback(async (userId: string) => {
    console.log('Loading chronic conditions for user:', userId);
    const { data, error } = await supabase
      .from('chronic_conditions')
      .select('*')
      .eq('user_id', userId)
      .order('diagnosed_date', { ascending: false });

    if (error) {
      console.error('Error loading chronic conditions:', error);
      return [];
    }

    console.log('Loaded chronic conditions:', data);
    return data || [];
  }, []);

  // Load health parameters for a user
  const loadHealthParameters = useCallback(async (userId: string) => {
    console.log('Loading health parameters for user:', userId);
    const { data, error } = await supabase
      .from('health_parameters')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error loading health parameters:', error);
      return [];
    }

    console.log('Loaded health parameters:', data);
    return data || [];
  }, []);

  // Load timeline events for a user
  const loadTimelineEvents = useCallback(async (patientId: string) => {
    console.log('Loading timeline events for patient:', patientId);
    const { data, error } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('patient_id', patientId)
      .order('event_time', { ascending: false });

    if (error) {
      console.error('Error loading timeline events:', error);
      return [];
    }

    console.log('Loaded timeline events:', data);
    return data || [];
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!user?.id) {
      console.log('No user ID available, skipping data refresh');
      return;
    }

    console.log('Refreshing data for user:', user.id);

    // First try the backend reports endpoint — avoids 404 when user_profiles table is missing
    const apiBase = getApiBaseUrl();
    try {
      if (session?.access_token) {
        console.log('📡 [DataContext] START fetch user-summary from:', `${apiBase}/api/reports/user-summary`);
        const resp = await fetch(`${apiBase}/api/reports/user-summary`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        console.log('📡 [DataContext] END fetch user-summary:', resp.status);

        if (resp.ok) {
          const rpt = await resp.json();
          if (rpt.found) {
            // Map and set user profile from the latest report and skip direct DB read
            // Support both legacy `report` and new `profile` field names
            const profile = rpt.profile || rpt.report || {};
            const [firstName, ...rest] = (profile.name || '').split(' ');
            const lastName = rest.length > 0 ? rest.join(' ') : null;

            const computeAge = (dobVal: any) => {
              try {
                if (!dobVal) return null;
                const d = new Date(dobVal);
                if (isNaN(d.getTime())) return null;
                const diff = Date.now() - d.getTime();
                const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
                return age;
              } catch (e) { return null; }
            };

            const hp = profile.height && typeof profile.height === 'object'
              ? { value: profile.height.value ?? null, unit: profile.height.unit ?? 'cm' }
              : (typeof profile.height === 'number' ? { value: profile.height, unit: 'cm' } : null);

            const wp = profile.weight && typeof profile.weight === 'object'
              ? { value: profile.weight.value ?? null, unit: profile.weight.unit ?? 'kg' }
              : (typeof profile.weight === 'number' ? { value: profile.weight, unit: 'kg' } : null);

            const normalizedProfile = {
              user_id: user.id,
              health_metrics: {
                blood_type: profile.bloodType || null,
                height: profile.height?.value ?? (hp?.value ?? null),
                weight: profile.weight?.value ?? (wp?.value ?? null),
                bmi: profile.bmi ?? null,
              },
              blood_type: profile.bloodType || null,
              bmi: profile.bmi ?? null,
              height: hp,
              weight: wp,
              age: profile.age ?? computeAge(profile.dob || profile.dateOfBirth || profile.dobString || null),
              allergies: rpt.allergies || profile.allergies || [],
              medications: rpt.medications || profile.medications || [],
              first_name: profile.name ? firstName : null,
              last_name: lastName,
              dob: profile.dob || profile.dateOfBirth || null,
              gender: profile.gender || null,
              mobile: profile.mobile || profile.phone || null,
              emergency_contact: profile.emergencyContact || null,
            } as any;

            if (normalizedProfile) {
              setUserProfile(normalizedProfile);
            }

            // Skip synthesis — we load from timeline_events for the real history
            /* 
            setTimelineEvents([
              {
                id: `report-${Date.now()}`,
                title: eventInfo?.displayTitle || `Report uploaded`,
                description: eventInfo?.displaySubtitle || `Extracted — Blood: ${profile.bloodType || 'N/A'}`,
                type: (eventInfo?.eventType || 'test') as any,
                status: (eventInfo?.status || 'completed') as any,
                date: eventInfo?.displayDate || rpt.uploaded_at || new Date().toISOString(),
                eventInfo: eventInfo || undefined,
              },
            ]);
            */

            // Attempt to load structured parameters from the backend reports API
            try {
              let parameters: any[] = (rpt.report && rpt.report.data && rpt.report.data.parameters) || [];
              if ((!parameters || parameters.length === 0) && session?.access_token) {
                const pResp = await fetch(`${apiBase}/api/reports/user-health-parameters`, {
                  headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (pResp.ok) {
                  const pjson = await pResp.json();
                  parameters = pjson.parameters || [];
                }
              }
              setHealthParameters(normalizeReportParameters(parameters || []));
              // Also populate chronic conditions from the report if present
              try {
                const conditions = (rpt.conditions || (rpt.report && rpt.report.data && rpt.report.data.conditions) || []);
                const fallbackDate = (rpt.report && rpt.report.metadata && rpt.report.metadata.documentDate) || rpt.metadata?.documentDate || rpt.uploaded_at || null;
                setChronicConditions((conditions || []).map((c: any) => {
                  const nc = normalizeCondition(c || {});
                  // prefer fallbackDate when condition lacks a real diagnosedDate
                  if ((!nc.diagnosedDate || nc.diagnosedDate === '') && fallbackDate) nc.diagnosedDate = fallbackDate;
                  return nc;
                }));
              } catch (e) {
                console.warn('Failed to set chronic conditions from report:', e);
              }
              // Also populate medications from the report
              try {
                const meds = (rpt.medications || (rpt.report && rpt.report.data && rpt.report.data.medications) || []);
                setMedications(normalizeMedications(meds || []));
              } catch (e) {
                console.warn('Failed to set medications from report:', e);
              }
            } catch (e) {
              console.warn('Failed to load report parameters from backend:', e);
            }

            // Skip the direct Supabase user_profiles read — backend covers the fallback
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Reports API fallback error:', e);
      // Continue to attempt user_profiles read — do not fail here
    }

    // Try to fetch existing profile from Supabase
    // ✅ Use maybeSingle() to allow 0 rows without throwing error
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();  // ✅ CRITICAL: Prevents 406 error when profile doesn't exist

    if (error) {
      // If the user_profiles table doesn't exist in this Supabase instance
      // (PGRST205) then fall back to fetching the latest processed report
      // from the backend API and synthesize a profile so the UI can show
      // extracted values even when the profile table is missing.
      if (error.code === 'PGRST205') {
        console.warn('user_profiles table not found, falling back to reports API');

        try {
          if (!session?.access_token) {
            console.warn('No session token available to call backend reports API');
          } else {
            const apiBase = getApiBaseUrl();
            const resp = await fetch(`${apiBase}/api/reports/user-summary`, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            if (resp.ok) {
              const rpt = await resp.json();
              if (rpt.found) {
                const profile = rpt.profile || rpt.report || {};
                // Map common profile fields into normalized profile used by UI
                // Try to fill first_name/last_name, dob, gender, mobile, emergency_contact
                const [firstName, ...rest] = (profile.name || '').split(' ');
                const lastName = rest.length > 0 ? rest.join(' ') : null;

                const computeAge = (dobVal: any) => {
                  try {
                    if (!dobVal) return null;
                    const d = new Date(dobVal);
                    if (isNaN(d.getTime())) return null;
                    const diff = Date.now() - d.getTime();
                    const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
                    return age;
                  } catch (e) { return null; }
                };

                const hp = profile.height && typeof profile.height === 'object'
                  ? { value: profile.height.value ?? null, unit: profile.height.unit ?? 'cm' }
                  : (typeof profile.height === 'number' ? { value: profile.height, unit: 'cm' } : null);

                const wp = profile.weight && typeof profile.weight === 'object'
                  ? { value: profile.weight.value ?? null, unit: profile.weight.unit ?? 'kg' }
                  : (typeof profile.weight === 'number' ? { value: profile.weight, unit: 'kg' } : null);

                const normalizedProfile = {
                  user_id: user.id,
                  health_metrics: {
                    blood_type: profile.bloodType || null,
                    height: profile.height?.value ?? (hp?.value ?? null),
                    weight: profile.weight?.value ?? (wp?.value ?? null),
                    bmi: profile.bmi ?? null,
                  },
                  blood_type: profile.bloodType || null,
                  bmi: profile.bmi ?? null,
                  height: hp,
                  weight: wp,
                  age: profile.age ?? computeAge(profile.dob || profile.dateOfBirth || profile.dobString || null),
                  allergies: rpt.allergies || [],
                  medications: rpt.medications || [],
                  // Add additional top-level fields so Dashboard shows them
                  first_name: profile.name ? firstName : null,
                  last_name: lastName,
                  dob: profile.dob || profile.dateOfBirth || null,
                  gender: profile.gender || null,
                  mobile: profile.mobile || profile.phone || null,
                  emergency_contact: profile.emergencyContact || null,
                } as any;

                if (normalizedProfile) {
                  setUserProfile(normalizedProfile);
                }

                // Skip synthesis — we load from timeline_events for the real history
                // const reportData = rpt.report || {};
                // const eventInfo = reportData.eventInfo || null;

                // setTimelineEvents([{
                //   id: `report-${Date.now()}`,
                //   title: eventInfo?.displayTitle || `Report uploaded`,
                //   description: eventInfo?.displaySubtitle || `Extracted — Blood: ${profile.bloodType || 'N/A'}`,
                //   type: (eventInfo?.eventType || 'test') as any,
                //   status: (eventInfo?.status || 'completed') as any,
                //   date: eventInfo?.displayDate || rpt.uploaded_at || new Date().toISOString(),
                //   eventInfo: eventInfo || undefined,
                // }]);

                // Also populate medications for the UI
                try {
                  const meds = (rpt.medications || (rpt.report && rpt.report.data && rpt.report.data.medications) || []);
                  setMedications(normalizeMedications(meds || []));
                } catch (e) {
                  console.warn('Failed to set medications from fallback report:', e);
                }

                // Load extracted parameters for the UI as well
                try {
                  let parameters: any[] = (rpt.report && rpt.report.data && rpt.report.data.parameters) || [];
                  const apiBase = getApiBaseUrl();
                  if ((!parameters || parameters.length === 0) && session?.access_token) {
                    const pResp = await fetch(`${apiBase}/api/reports/user-health-parameters`, {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (pResp.ok) {
                      const pjson = await pResp.json();
                      parameters = pjson.parameters || [];
                    }
                  }
                  setHealthParameters(normalizeReportParameters(parameters || []));
                  // Also populate chronic conditions from the report payload
                  try {
                    const conditions = (rpt.conditions || (rpt.report && rpt.report.data && rpt.report.data.conditions) || []);
                    const fallbackDate = (rpt.report && rpt.report.metadata && rpt.report.metadata.documentDate) || rpt.metadata?.documentDate || rpt.uploaded_at || null;
                    setChronicConditions((conditions || []).map((c: any) => {
                      const nc = normalizeCondition(c || {});
                      if ((!nc.diagnosedDate || nc.diagnosedDate === '') && fallbackDate) nc.diagnosedDate = fallbackDate;
                      return nc;
                    }));
                  } catch (e) {
                    console.warn('Failed to set chronic conditions from fallback report:', e);
                  }
                } catch (e) {
                  console.warn('Failed to load backend report parameters (fallback):', e);
                }
              }
            } else {
              console.warn('Reports API returned non-OK:', resp.status);
            }
          }
        } catch (e) {
          console.error('Fallback reports API error:', e);
        }

        return;
      }

      console.error('Error fetching user profile:', error);
      return;
    }

    console.log('User profile loaded:', data);
    if (!data) {
      console.log('No user profile found in DB');
      return;
    }
    // Normalize health_metrics JSON into convenient top-level shapes expected
    const hm = (data as any).health_metrics || {};
    const normalizedProfile = {
      ...data,
      bmi: hm.bmi ?? (data as any).bmi,
      blood_type: hm.blood_type ?? (data as any).blood_type,
      height: hm.height !== undefined ? { value: hm.height, unit: 'cm' } : (data as any).height,
      weight: hm.weight !== undefined ? { value: hm.weight, unit: 'kg' } : (data as any).weight,
      // keep original health_metrics
      health_metrics: hm,
      // Normalize contact fields used by UI
      mobile: (data as any).mobile_number ?? (data as any).mobile ?? (data as any).phone,
      emergency_contact: Array.isArray((data as any).emergency_contacts) && (data as any).emergency_contacts.length > 0
        ? ((data as any).emergency_contacts[0].phone || (data as any).emergency_contacts[0].name)
        : (data as any).emergency_contact ?? null
    };

    setUserProfile(normalizedProfile as any);

    // Load health parameters, timeline events, and chronic conditions
    const [params, events, conditions] = await Promise.all([
      loadHealthParameters(user.id),
      loadTimelineEvents(user.id),
      loadChronicConditions(user.id)
    ]);

    setHealthParameters(params);
    setTimelineEvents(events);
    setChronicConditions((conditions || []).map((c: any) => normalizeCondition(c || {})));
  }, [user?.id, session?.access_token]);

  // Load user data when the user id changes.
  // We intentionally depend only on `user?.id` to avoid refreshUserData's
  // changing identity triggering repeated runs which can cause render loops.
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    (async () => {
      if (!mounted) return;
      try {
        await refreshUserData();
      } catch (err) {
        console.error('refreshUserData failed in effect:', err);
      }
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  const applyUpdate = useCallback(async (instruction: UpdateInstruction) => {
    if (!user?.id) {
      console.error('No user ID available for update');
      return;
    }

    console.log('Applying update:', instruction);

    try {
      switch (instruction.section) {
        case 'allergies':
          if (instruction.op === 'add') {
            const currentAllergies = userProfile?.allergies || [];
            const { error } = await supabase
              .from('user_profiles')
              .update({ allergies: [...currentAllergies, instruction.value] })
              .eq('user_id', user.id);

            if (error) throw error;
            console.log('Added allergy:', instruction.value);
            await refreshUserData();
          } else if (instruction.op === 'delete') {
            const currentAllergies = userProfile?.allergies || [];
            const { error } = await supabase
              .from('user_profiles')
              .update({
                allergies: currentAllergies.filter(a => a !== instruction.value),
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id);

            if (error) throw error;
            console.log('Removed allergy:', instruction.value);
            await refreshUserData();
          }
          break;

        case 'healthParameters':
          if (instruction.op === 'add') {
            const { error } = await supabase
              .from('health_parameters')
              .insert([{
                user_id: user.id,
                ...instruction.value
              }]);

            if (error) throw error;
            console.log('Added health parameter:', instruction.value);
            await refreshUserData();
          } else if (instruction.op === 'update') {
            // If key (id) provided, update specific record. Otherwise try to
            // find the most recent parameter by name and update that record.
            if (instruction.key) {
              const { error } = await supabase
                .from('health_parameters')
                .update(instruction.value)
                .eq('id', instruction.key)
                .eq('user_id', user.id);

              if (error) throw error;
              console.log('Updated health parameter by id:', instruction.key);
              await refreshUserData();
            } else if (instruction.value?.name) {
              const name = instruction.value.name;
              // Find the most recent parameter with this name in local state
              const candidate = healthParameters
                .filter(p => (p.name || '').toString().toLowerCase() === name.toString().toLowerCase())
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

              if (candidate && candidate.id) {
                const { error } = await supabase
                  .from('health_parameters')
                  .update({ ...instruction.value })
                  .eq('id', candidate.id)
                  .eq('user_id', user.id);

                if (error) throw error;
                console.log('Updated latest health parameter for name:', name);
                await refreshUserData();
              } else {
                // Fallback: insert as new if no candidate found
                const { error } = await supabase
                  .from('health_parameters')
                  .insert([{ user_id: user.id, ...instruction.value }]);
                if (error) throw error;
                console.log('Inserted health parameter as fallback for:', name);
                await refreshUserData();
              }
            }
          }
          break;

        case 'chronicConditions':
          if (instruction.op === 'add') {
            const { error } = await supabase
              .from('chronic_conditions')
              .insert([{
                user_id: user.id,
                ...instruction.value
              }]);

            if (error) throw error;
            console.log('Added chronic condition:', instruction.value);
            await refreshUserData();
          } else if (instruction.op === 'update') {
            const { error } = await supabase
              .from('chronic_conditions')
              .update(instruction.value)
              .eq('user_id', user.id)
              .eq('name', instruction.key);

            if (error) throw error;
            console.log('Updated chronic condition:', instruction.key);
            await refreshUserData();
          } else if (instruction.op === 'delete') {
            const { error } = await supabase
              .from('chronic_conditions')
              .delete()
              .eq('user_id', user.id)
              .eq('name', instruction.value);

            if (error) throw error;
            console.log('Deleted chronic condition:', instruction.value);
            await refreshUserData();
          }
          break;

        case 'timelineEvents':
          if (instruction.op === 'add') {
            const { error } = await supabase
              .from('timeline_events')
              .insert([{
                user_id: user.id,
                ...instruction.value
              }]);

            if (error) throw error;
            console.log('Added timeline event:', instruction.value);
            await refreshUserData();
          }
          break;

        case 'medications':
          if (instruction.op === 'add' || instruction.op === 'delete') {
            const currentMeds = userProfile?.medications || [];
            const newMeds = instruction.op === 'add'
              ? [...currentMeds, instruction.value]
              : currentMeds.filter(m => m !== instruction.value);

            const { error } = await supabase
              .from('user_profiles')
              .update({ medications: newMeds })
              .eq('user_id', user.id);

            if (error) throw error;
            console.log(`${instruction.op === 'add' ? 'Added' : 'Removed'} medication:`, instruction.value);
            await refreshUserData();
          } else if (instruction.op === 'update' && instruction.key) {
            const currentMeds = userProfile?.medications || [];
            const newMeds = currentMeds.map(med =>
              med.startsWith(instruction.key!) ? instruction.value : med
            );

            const { error } = await supabase
              .from('user_profiles')
              .update({ medications: newMeds })
              .eq('user_id', user.id);

            if (error) throw error;
            console.log('Updated medication:', instruction.value);
            await refreshUserData();
          }
          break;
          break;

        case 'profile':
          // If updating common health metrics (bmi, height, weight, blood_type)
          // they are stored under the `health_metrics` JSON column on user_profiles.
          // Merge updates into that JSON object instead of writing top-level fields.
          const healthMetricKeys = new Set(['bmi', 'height', 'weight', 'blood_type']);

          if (instruction.key && healthMetricKeys.has(instruction.key)) {
            // Merge into existing health_metrics
            const currentProfile = userProfile || (await (async () => {
              // ✅ Use maybeSingle() to prevent 406 error
              const { data } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
              return data || null;
            })());

            const existingMetrics = (currentProfile && (currentProfile as any).health_metrics) || {};
            const newMetrics = { ...existingMetrics, [instruction.key]: instruction.value };

            const { error } = await supabase
              .from('user_profiles')
              .update({ health_metrics: newMetrics, updated_at: new Date().toISOString() })
              .eq('user_id', user.id);

            if (error) throw error;
            await refreshUserData();
          } else {
            // If a key is provided but not a health metric, update top-level profile field.
            const payload = instruction.key ? { [instruction.key]: instruction.value } : (typeof instruction.value === 'object' ? instruction.value : {});
            if (Object.keys(payload).length === 0) {
              console.warn('Profile update with empty payload:', instruction);
              break;
            }

            const { error } = await supabase
              .from('user_profiles')
              .update(payload)
              .eq('user_id', user.id);

            if (error) throw error;
            await refreshUserData();
          }
          break;

        // Local state updates are handled via refreshUserData after DB operations
      }
    } catch (error) {
      console.error('Error applying update:', error);
    }
  }, [user?.id, refreshUserData, healthParameters]);

  const applyUpdates = useCallback((instructions: UpdateInstruction[]) => {
    instructions.forEach(applyUpdate);
  }, [applyUpdate]);

  const resetData = useCallback(async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from('user_profiles')
        .delete()
        .eq('id', user.id);

      setUserProfile(null);
      setHealthParameters([]);
      setTimelineEvents([]);
      setMedications([]);
    } catch (error) {
      console.error('Error resetting data:', error);
    }
  }, [user?.id]);

  const value = {
    userProfile,
    healthParameters,
    timelineEvents,
    chronicConditions,
    medications,
    applyUpdate,
    applyUpdates,
    resetData,
    refreshUserData
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}