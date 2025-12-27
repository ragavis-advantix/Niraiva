import { Router } from "express";
import axios from "axios";
import { getSupabaseAdminClient } from "../../lib/supabaseClient";

const FRONTEND_URL = process.env.FRONTEND_URL || "https://niraiva-app.vercel.app";

router.get("/", async (req, res) => {
    const { code, state } = req.query;

    if (!code) {
        return res.redirect(`${FRONTEND_URL}/upload-reports?error=no_code`);
    }

    try {
        // Exchange code for tokens
        const response = await axios.post("https://oauth2.googleapis.com/token", {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            grant_type: "authorization_code",
        });

        const { access_token, refresh_token } = response.data;

        // Get user from authenticated session
        // Note: User must be logged in when they initiated OAuth
        // We'll store tokens temporarily and associate them after redirect
        // For now, log the tokens (in production, use session state)

        console.log("✅ Google OAuth successful - tokens received");
        console.log("Access token:", access_token ? "present" : "missing");
        console.log("Refresh token:", refresh_token ? "present" : "missing");
        console.log("State:", state);

        // TODO: Store tokens in database with user association
        // This requires the user to be authenticated when returning from OAuth
        // Best practice: Store state parameter with user ID before OAuth redirect

        // Determine which service was linked based on state
        const service = state === 'drive' ? 'drive' : 'gmail';
        const redirectParam = service === 'drive' ? 'driveLinked' : 'gmailLinked';

        return res.redirect(`${FRONTEND_URL}/upload-reports?${redirectParam}=true`);
    } catch (error: any) {
        console.error("❌ OAuth callback error:", error.response?.data || error.message);
        return res.redirect(`${FRONTEND_URL}/upload-reports?error=oauth_failed`);
    }
});

export default router;
