import { supabase } from "@/lib/supabase";

export async function fetchTimelineParameters(
    userId: string,
    eventDate: string
) {
    try {
        const { data, error } = await supabase
            .from("health_parameters")
            .select("id, name, value, unit, status, measured_at, source")
            .eq("user_id", userId)
            .lte("measured_at", `${eventDate}T23:59:59`)
            .gte("measured_at", `${eventDate}T00:00:00`)
            .order("measured_at", { ascending: false });

        if (error) {
            console.error("Failed to fetch timeline parameters:", error);
            throw error;
        }

        // Deduplicate per parameter name (keep latest)
        const latestByName = new Map<string, any>();

        for (const row of data ?? []) {
            if (!latestByName.has(row.name)) {
                latestByName.set(row.name, row);
            }
        }

        return Array.from(latestByName.values());
    } catch (error) {
        console.error("Error in fetchTimelineParameters:", error);
        return [];
    }
}
