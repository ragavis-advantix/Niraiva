import { Router, type Request, type Response, type NextFunction } from "express";
import { getSupabaseAdminClient } from "../lib/supabaseClient";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next?: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

/**
 * POST /api/auth/bootstrap-patient
 * On first login of a patient, automatically create the patients row.
 * Guaranteed idempotency via upsert.
 */
router.post(
    "/bootstrap-patient",
    verifyToken,
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const user = req.user; // Attached by verifyToken middleware

        if (!user || !user.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        console.log(`🚀 [BOOTSTRAP] Bootstrapping patient for user_id: ${user.id}`);

        try {
            const supabaseAdmin = getSupabaseAdminClient();

            // Check if user_roles entry exists
            const { data: existingRole, error: checkError } = await supabaseAdmin
                .from('user_roles')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                // PGRST116 = not found, which is fine
                console.error("❌ [BOOTSTRAP CHECK ERROR]:", checkError);
                res.status(500).json({ error: checkError.message });
                return;
            }

            if (existingRole) {
                console.log("✅ [BOOTSTRAP] User role already exists.");
                res.json({ success: true, role: existingRole });
                return;
            }

            // Create user_roles entry
            const { data: newRole, error: insertError } = await supabaseAdmin
                .from('user_roles')
                .insert({
                    user_id: user.id,
                    role: 'patient'
                })
                .select()
                .single();

            if (insertError) {
                console.error("❌ [BOOTSTRAP INSERT ERROR]:", insertError);
                res.status(500).json({ error: insertError.message });
                return;
            }

            console.log("✅ [BOOTSTRAP] User role created successfully.");
            res.json({ success: true, role: newRole });

        } catch (err: any) {
            console.error("❌ [BOOTSTRAP CRITICAL ERROR]:", err);
            res.status(500).json({ error: err.message });
        }
    })
);

export default router;
