import type { NextFunction, Request, Response } from "express";
import { getSupabaseAdminClient } from "../lib/supabaseClient";

declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export const verifyToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        let supabaseAdmin;
        try {
            supabaseAdmin = getSupabaseAdminClient();
        } catch (error) {
            console.error("Supabase configuration error:", error);
            return res.status(500).json({
                error: "Server misconfigured",
                message: "Supabase admin client is not configured correctly.",
            });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Authorization header missing." });
        }

        const token = authHeader.replace("Bearer ", "");
        if (!token || token === 'null' || token === 'undefined') {
            return res.status(401).json({ error: "Valid Bearer token missing." });
        }

        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data?.user) {
            console.warn("🛡️ [AUTH] Supabase verification failed:", error?.message ?? "User not found");
            return res.status(401).json({
                error: "Invalid or expired token.",
                details: error?.message
            });
        }

        // Attach user to request for downstream use
        req.user = data.user;

        return next();
    } catch (error) {
        console.error("Token verification failed:", error);
        return res.status(401).json({ error: "Authentication failed." });
    }
};

