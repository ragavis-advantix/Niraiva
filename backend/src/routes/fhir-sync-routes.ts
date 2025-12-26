import type { Request, Response } from "express";
import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseClient";
import {
    syncPatient,
    syncObservation,
    getFhirPatientId,
} from "../lib/fhir-sync";

const router = Router();

/**
 * POST /sync-to-fhir
 * Main sync endpoint - syncs all patient data to FHIR
 */
router.post("/sync-to-fhir", async (req: Request, res: Response) => {
    const user = (req as any).user;

    if (!user || !user.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        // Create sync log
        const { data: syncLog, error: logError } = await supabaseAdmin
            .from("fhir_sync_logs")
            .insert({
                user_id: user.id,
                sync_type: "full",
                status: "in_progress",
            })
            .select()
            .single();

        if (logError) {
            console.error("Failed to create sync log:", logError);
            return res.status(500).json({ error: "Failed to create sync log" });
        }

        const syncedResources: any[] = [];
        const errors: string[] = [];

        // 1. Sync Patient profile
        const { data: profile } = await supabaseAdmin
            .from("user_profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (profile) {
            const patientResponse = await syncPatient({
                userId: user.id,
                firstName: profile.first_name,
                middleName: profile.middle_name,
                lastName: profile.last_name,
                email: profile.email,
                mobile: profile.mobile,
                gender: profile.gender,
                dob: profile.dob,
                abhaNumber: profile.abha_number,
            });

            if (patientResponse.ok && patientResponse.data) {
                syncedResources.push({
                    resourceType: "Patient",
                    id: patientResponse.data.id,
                });
            } else {
                errors.push(`Patient sync failed: ${patientResponse.error}`);
            }
        }

        // 2. Sync recent vitals/observations
        const { data: observations } = await supabaseAdmin
            .from("observations")
            .select("*")
            .eq("user_id", user.id)
            .order("timestamp", { ascending: false })
            .limit(10);

        if (observations && observations.length > 0) {
            for (const obs of observations) {
                const vitalResponse = await syncObservation(user.id, {
                    type: obs.code as any,
                    value: obs.value,
                    unit: obs.unit,
                    timestamp: obs.timestamp,
                });

                if (vitalResponse.ok && vitalResponse.data) {
                    syncedResources.push({
                        resourceType: "Observation",
                        id: vitalResponse.data.id,
                    });
                } else {
                    errors.push(
                        `Observation sync failed for ${obs.code}: ${vitalResponse.error}`
                    );
                }
            }
        }

        // Update sync log
        const finalStatus = errors.length === 0 ? "completed" : "failed";
        await supabaseAdmin
            .from("fhir_sync_logs")
            .update({
                status: finalStatus,
                resources_synced: syncedResources,
                error_message: errors.length > 0 ? errors.join("; ") : null,
                completed_at: new Date().toISOString(),
            })
            .eq("id", syncLog.id);

        return res.json({
            success: errors.length === 0,
            syncId: syncLog.id,
            syncedResources,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error("Sync to FHIR error:", error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown sync error",
        });
    }
});

/**
 * POST /sync-vitals
 * Sync specific vitals observation
 */
router.post("/sync-vitals", async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { type, value, unit, systolic, diastolic, timestamp } = req.body;

    if (!user || !user.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (!type || value === undefined) {
        return res.status(400).json({ error: "Missing required fields: type, value" });
    }

    try {
        // Create sync log
        const { data: syncLog } = await supabaseAdmin
            .from("fhir_sync_logs")
            .insert({
                user_id: user.id,
                sync_type: "vitals",
                status: "in_progress",
            })
            .select()
            .single();

        const response = await syncObservation(user.id, {
            type,
            value,
            unit,
            systolic,
            diastolic,
            timestamp,
        });

        if (response.ok && response.data) {
            // Update sync log
            await supabaseAdmin
                .from("fhir_sync_logs")
                .update({
                    status: "completed",
                    resources_synced: [
                        {
                            resourceType: "Observation",
                            id: response.data.id,
                        },
                    ],
                    completed_at: new Date().toISOString(),
                })
                .eq("id", syncLog?.id);

            return res.json({
                success: true,
                syncId: syncLog?.id,
                resource: response.data,
            });
        } else {
            // Update sync log with error
            if (syncLog) {
                await supabaseAdmin
                    .from("fhir_sync_logs")
                    .update({
                        status: "failed",
                        error_message: response.error,
                        completed_at: new Date().toISOString(),
                    })
                    .eq("id", syncLog.id);
            }

            return res.status(500).json({
                success: false,
                error: response.error,
            });
        }
    } catch (error) {
        console.error("Sync vitals error:", error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown sync error",
        });
    }
});

/**
 * GET /sync-status/:syncId
 * Check sync job status
 */
router.get("/sync-status/:syncId", async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { syncId } = req.params;

    if (!user || !user.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const { data: syncLog, error } = await supabaseAdmin
            .from("fhir_sync_logs")
            .select("*")
            .eq("id", syncId)
            .eq("user_id", user.id)
            .single();

        if (error || !syncLog) {
            return res.status(404).json({ error: "Sync log not found" });
        }

        return res.json(syncLog);
    } catch (error) {
        console.error("Get sync status error:", error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

/**
 * GET /sync-history
 * Get user's sync history
 */
router.get("/sync-history", async (req: Request, res: Response) => {
    const user = (req as any).user;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!user || !user.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const { data: syncLogs, error } = await supabaseAdmin
            .from("fhir_sync_logs")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            return res.status(500).json({ error: "Failed to fetch sync history" });
        }

        return res.json({ syncLogs });
    } catch (error) {
        console.error("Get sync history error:", error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

export default router;
