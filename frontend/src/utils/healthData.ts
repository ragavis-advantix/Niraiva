import { supabase } from "../lib/supabase";

export interface UserProfile {
  id: string;
  user_id: string;
  full_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  gender?: string | null;
  age?: number | null; // ✅ Added age field
  blood_type?: string | null;
  bmi?: number | null; // ✅ Added top-level BMI field
  height?: {
    value?: number | null;
    unit?: string | null;
  } | null;
  weight?: {
    value?: number | null;
    unit?: string | null;
  } | null;
  mobile?: string | null;
  emergency_contact?: string | null;
  abha_id?: string;
  abha_number?: string;
  abha_profile?: any;
  allergies?: string[];
  medications?: string[];
  chronic_conditions?: string[];
  recent_appointments?: any[];
  health_metrics?: {
    height?: number;
    weight?: number;
    bmi?: number;
    blood_type?: string;
  };
  emergency_contacts?: {
    name: string;
    relationship: string;
    phone: string;
  }[];
  created_at?: string;
  updated_at?: string;
}

export interface ChronicCondition {
  id: string;
  name: string;
  diagnosedDate: string;
  severity: "mild" | "moderate" | "severe";
  currentStatus: "controlled" | "uncontrolled" | "improving" | "worsening";
  relatedParameters: string[];
}

export interface HealthParameter {
  id: string;
  name: string;
  value: string | number;
  unit?: string;
  status: "normal" | "warning" | "critical";
  recentChange?: "improved" | "declined" | "stable";
  timestamp: string;
}

export interface TimelineEvent {
  id: string;
  date?: string; // Legacy
  event_time: string;
  title: string;
  description: string;
  type?: "test" | "diagnosis" | "treatment" | "medication" | "appointment"; // Legacy
  category: "appointment" | "test" | "medication" | "report" | "note" | "ai_summary";
  parameters?: HealthParameter[];
  related?: string[];
  status: "completed" | "pending" | "missed" | "active";
  highlight?: boolean;
  source_file_id?: string;
  // NEW: Clinical event date fields for proper timeline ordering
  clinical_event_date?: string; // ISO DATE (YYYY-MM-DD): actual medical event date
  report_date?: string;         // ISO DATE: report/document creation date
  upload_date?: string;         // ISO TIMESTAMP: when report was uploaded
  eventInfo?: {
    eventType: "test" | "diagnosis" | "treatment" | "medication" | "appointment" | "profile" | "other";
    status: "completed" | "pending";
    displayTitle: string;
    displaySubtitle: string | null;
    displayDate: string | null;
    icon: string;
    details: {
      parameters?: any[];
      medications?: any[];
      appointments?: any[];
      conditions?: any[];
      notes?: string | null;
    };
  };
}

export interface DiagnosticNode {
  id: string;
  name: string;
  value?: string | number;
  unit?: string;
  children?: DiagnosticNode[];
}

export async function getHealthParameters(userId: string): Promise<HealthParameter[]> {
  const { data, error } = await supabase
    .from("health_parameters")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching health parameters:", error);
    return [];
  }

  return data || [];
}

export async function addHealthParameter(
  userId: string,
  parameter: Omit<HealthParameter, "id">
): Promise<HealthParameter | null> {
  const { data, error } = await supabase
    .from("health_parameters")
    .insert([{ ...parameter, user_id: userId }])
    .select()
    .single();

  if (error) {
    console.error("Error adding health parameter:", error);
    return null;
  }

  return data;
}

export async function getChronicConditions(userId: string): Promise<ChronicCondition[]> {
  const { data, error } = await supabase
    .from("chronic_conditions")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching chronic conditions:", error);
    return [];
  }

  return data || [];
}

export async function addChronicCondition(
  userId: string,
  condition: Omit<ChronicCondition, "id">
): Promise<ChronicCondition | null> {
  const { data, error } = await supabase
    .from("chronic_conditions")
    .insert([{ ...condition, user_id: userId }])
    .select()
    .single();

  if (error) {
    console.error("Error adding chronic condition:", error);
    return null;
  }

  return data;
}

export async function getTimelineEvents(userId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching timeline events:", error);
    return [];
  }

  return data || [];
}

export async function addTimelineEvent(
  userId: string,
  event: Omit<TimelineEvent, "id">
): Promise<TimelineEvent | null> {
  const { data, error } = await supabase
    .from("timeline_events")
    .insert([{ ...event, user_id: userId }])
    .select()
    .single();

  if (error) {
    console.error("Error adding timeline event:", error);
    return null;
  }

  return data;
}

export async function getRecentHealthParameters(
  userId: string,
  limit = 5
): Promise<HealthParameter[]> {
  const { data, error } = await supabase
    .from("health_parameters")
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching recent health parameters:", error);
    return [];
  }

  return data || [];
}

// Utility function to get CSS class based on status
export function getStatusClass(status: HealthParameter["status"]): string {
  switch (status) {
    case "normal":
      return "text-green-500";
    case "warning":
      return "text-yellow-500";
    case "critical":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
}

// Utility function to get icon based on change status
export function getChangeIcon(change?: HealthParameter["recentChange"]): string {
  switch (change) {
    case "improved":
      return "↑";
    case "declined":
      return "↓";
    case "stable":
      return "→";
    default:
      return "-";
  }
}

// Function to check if ABHA is linked for a user
export async function checkAbhaLinked(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("abha_number")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return false;
  }

  return !!data.abha_number;
}

// Function to save ABHA profile
export async function saveAbhaProfile(userId: string, abhaData: any): Promise<boolean> {
  const { error } = await supabase
    .from("user_profiles")
    .upsert({
      user_id: userId,
      abha_number: abhaData.ABHANumber, // Use ABHANumber from the profile
      first_name: abhaData.firstName,
      middle_name: abhaData.middleName,
      last_name: abhaData.lastName,
      dob: abhaData.dob,
      gender: abhaData.gender,
      mobile_number: abhaData.mobile,
      preferred_abha_address: abhaData.preferredAddress,
      address: abhaData.address,
      district_code: abhaData.districtCode,
      state_code: abhaData.stateCode,
      pin_code: abhaData.pinCode,
      state_name: abhaData.stateName,
      district_name: abhaData.districtName,
      abha_status: abhaData.abhaStatus,
      photo: abhaData.photo,
      abha_profile: abhaData
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error("Error saving ABHA profile:", error);
    return false;
  }

  return true;
}

// Function to generate user-specific diagnostic nodes
// Now fetches REAL data from health reports and clinical events
export async function generateUserSpecificNodes(userId: string): Promise<DiagnosticNode[]> {
  try {
    // Fetch health reports for this user
    const { data: reports, error: reportsError } = await supabase
      .from("health_reports")
      .select("report_json, uploaded_at")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });

    if (reportsError) {
      console.error("Error fetching health reports:", reportsError);
      return [];
    }

    if (!reports || reports.length === 0) {
      console.log("No health reports found for user");
      return [];
    }

    const nodes: DiagnosticNode[] = [];
    const parameters: Map<string, HealthParameter> = new Map();
    const conditions: Map<string, any> = new Map();
    const medications: Map<string, any> = new Map();

    // Process all reports and aggregate real clinical data
    reports.forEach((report) => {
      if (!report.report_json) return;

      const reportData = report.report_json.data || {};

      // Extract parameters from report
      if (Array.isArray(reportData.parameters)) {
        reportData.parameters.forEach((param: any) => {
          const key = param.name || param.test;
          if (key && !parameters.has(key)) {
            parameters.set(key, {
              id: `param-${key}`,
              name: param.name || param.test,
              value: param.value ?? 0,
              unit: param.unit,
              status: param.status || "normal",
              timestamp: report.uploaded_at || new Date().toISOString()
            });
          }
        });
      }

      // Extract conditions from report
      if (Array.isArray(reportData.conditions)) {
        reportData.conditions.forEach((cond: any) => {
          const key = cond.name || cond.diagnosis;
          if (key && !conditions.has(key)) {
            conditions.set(key, {
              id: `cond-${key}`,
              name: cond.name || cond.diagnosis,
              severity: cond.severity || "moderate"
            });
          }
        });
      }

      // Extract medications from report
      if (Array.isArray(reportData.medications)) {
        reportData.medications.forEach((med: any) => {
          const key = med.name;
          if (key && !medications.has(key)) {
            medications.set(key, {
              id: `med-${key}`,
              name: med.name,
              dose: med.dose,
              frequency: med.frequency
            });
          }
        });
      }
    });

    // Create nodes from aggregated real data
    if (parameters.size > 0) {
      nodes.push({
        id: "health-parameters",
        name: "Health Parameters",
        value: parameters.size,
        unit: "items",
        children: Array.from(parameters.values()).map(param => ({
          id: param.id,
          name: param.name,
          value: param.value,
          unit: param.unit
        }))
      });
    }

    if (conditions.size > 0) {
      nodes.push({
        id: "chronic-conditions",
        name: "Chronic Conditions",
        value: conditions.size,
        unit: "conditions",
        children: Array.from(conditions.values()).map(cond => ({
          id: cond.id,
          name: cond.name,
          value: cond.severity
        }))
      });
    }

    if (medications.size > 0) {
      nodes.push({
        id: "active-medications",
        name: "Active Medications",
        value: medications.size,
        unit: "medications",
        children: Array.from(medications.values()).map(med => ({
          id: med.id,
          name: med.name,
          value: med.dose || "As prescribed"
        }))
      });
    }

    return nodes;
  } catch (error) {
    console.error("Error generating user-specific nodes:", error);
    return [];
  }
}
