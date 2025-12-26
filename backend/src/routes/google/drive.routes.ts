import { Router } from "express";

const router = Router();

router.get("/start", async (req, res) => {
    const redirectUri = encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || "");

    const scope = encodeURIComponent(
        "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email"
    );

    const url =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${process.env.GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${redirectUri}` +
        `&response_type=code` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&scope=${scope}`;

    console.log("🔗 DRIVE OAUTH URL:", url);

    return res.redirect(url);
});

export default router;
