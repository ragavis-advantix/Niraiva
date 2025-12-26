import { Router, type Request, type Response, type NextFunction } from "express";
import { getSupabaseAdminClient } from "../lib/supabaseClient";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next?: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

/**
 * POST /api/user/claim-profile
 * Allows a patient to claim a profile previously created by a doctor.
 */
router.post(
    "/claim-profile",
    verifyToken,
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const userId = req.user?.id;
        const { phone } = req.body;

        if (!userId || !phone) {
            res.status(400).json({ error: "User ID and phone number are required" });
            return;
        }

        console.log(`🔍 [CLAIM] Attempting to claim profile for userId: ${userId}, phone: ${phone}`);

        try {
            const supabaseAdmin = getSupabaseAdminClient();

            // 1. Check if an unclaimed profile exists with this phone
            const { data: existingProfile, error: fetchError } = await supabaseAdmin
                .from('user_profiles')
                .select('*')
                .eq('phone', phone)
                .is('user_id', null)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (!existingProfile) {
                console.log("ℹ️ [CLAIM] No unclaimed profile found for this phone.");
                res.json({ success: false, message: "No unclaimed profile found" });
                return;
            }

            console.log("✅ [CLAIM] Found unclaimed profile. Linking...");

            // 2. Claim the profile
            const { error: updateError } = await supabaseAdmin
                .from('user_profiles')
                .update({ user_id: userId })
                .eq('id', existingProfile.id);

            if (updateError) throw updateError;

            // 3. Ensure role is 'patient'
            await supabaseAdmin
                .from('user_roles')
                .upsert({ user_id: userId, role: 'patient' });

            res.json({ success: true, message: "Profile claimed successfully" });

        } catch (err: any) {
            console.error("❌ [CLAIM ERROR]:", err);
            res.status(500).json({ error: err.message });
        }
    })
);

export default router;
