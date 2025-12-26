// Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");

// Local modules
const { supabase, supabaseAdmin } = require("./connect");
const abhaRoutes = require("./abha-api");
const { router: fhirRoutes, webhookHandler } = require("./fhir");
const uploadReport = require("./routes/uploadReport");

const app = express();
const port = process.env.PORT || 5000;

/* --------------------------------------------------------------------------
   GLOBAL SETUP
-------------------------------------------------------------------------- */
app.use(cors());
app.use(express.json({ limit: "20mb" })); // allow larger JSON + base64 + OCR
app.use(express.urlencoded({ limit: "20mb", extended: true })); // for URL encoded data

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

/* --------------------------------------------------------------------------
   AUTH MIDDLEWARE
-------------------------------------------------------------------------- */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "No authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error) {
      console.error("❌ Supabase Auth Error:", error.message);
      return res.status(401).json({ message: "Invalid token" });
    }

    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    console.error("❌ Auth Middleware Exception:", err);
    return res
      .status(401)
      .json({ message: "Authentication failed", error: err.message });
  }
};

/* --------------------------------------------------------------------------
   ROUTES
-------------------------------------------------------------------------- */

console.log("📍 Registering routes...");

// ABHA API (Protected)
app.use("/api/abha", authMiddleware, abhaRoutes);
console.log("✅ /api/abha routes registered");

// Profile merging (Protected)
app.use("/api/me", authMiddleware, require("./me"));
console.log("✅ /api/me routes registered");

// FHIR API (Protected)
app.use("/api/fhir", authMiddleware, fhirRoutes);
console.log("✅ /api/fhir routes registered");

// Upload Report (handles its own auth inside)
app.use("/api", uploadReport);
console.log("✅ /api/upload-report routes registered");

/* --------------------------------------------------------------------------
   SUPABASE SIGNUP WEBHOOK — PUBLIC
   (Required because Supabase webhooks CANNOT send auth tokens)
-------------------------------------------------------------------------- */
app.post("/webhook/supabase-signup", async (req, res) => {
  console.log("=== 📩 Supabase Signup Webhook Triggered ===");
  try {
    await webhookHandler(req, res);
  } catch (err) {
    console.error("❌ Webhook Handler Error:", err);
    // Always return 200 so Supabase does not retry infinitely
    return res.status(200).json({ success: true, error: err.message });
  }
});

/* --------------------------------------------------------------------------
   HEALTH CHECK
-------------------------------------------------------------------------- */
app.get("/health", (req, res) => {
  res.json({ status: "healthy", env: process.env.NODE_ENV || "dev" });
});

/* --------------------------------------------------------------------------
   START SERVER
-------------------------------------------------------------------------- */
const startServer = () => {
  try {
    app.listen(port, () => {
      console.log("=======================================");
      console.log(`🚀 Niraiva Backend Running on port ${port}`);
      console.log("Environment:", process.env.NODE_ENV || "development");
      console.log("=======================================");
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
  }
};

startServer();
