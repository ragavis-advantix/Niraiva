import { supabase } from "@/lib/supabase";

export async function saveHealthParameter({
    userId,
    name,
    value,
    unit,
    status,
    measuredAt,
    source = "dashboard",
}: {
    userId: string;
    name: string;
    value: number;
    unit: string;
    status: "normal" | "warning" | "critical";
    measuredAt?: Date;
    source?: string;
}) {
    try {
        const { error } = await supabase.from("health_parameters").insert({
            user_id: userId,
            name,
            value,
            unit,
            status,
            measured_at: measuredAt ? measuredAt.toISOString() : new Date().toISOString(),
            source,
        });

        if (error) {
            console.error("Failed to save health parameter:", error);
            throw error;
        }

        return { success: true };
    } catch (error) {
        console.error("Error in saveHealthParameter:", error);
        throw error;
    }
}
