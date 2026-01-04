import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { verifyToken } from "./middleware/verifyToken";
import { fhirRouter } from "./routes/fhir";
// import { demoRouter } from "./routes/demo"; // Removed for production
import { uploadRouter } from "./routes/upload";
import uploadReportRouter from "./routes/uploadReport";
import reportsRouter from "./routes/reports";
import { abhaRouter } from "./routes/abha";
import fhirSyncRouter from "./routes/fhir-sync-routes";
import gmailRoutes from "./routes/google/gmail.routes";
import gmailListRoutes from "./routes/google/gmail.list";
import gmailImportRoutes from "./routes/google/gmail.import";
import driveRoutes from "./routes/google/drive.routes";
import driveListRoutes from "./routes/google/drive.list";
import driveImportRoutes from "./routes/google/drive.import";
import googleCallbackRoutes from "./routes/google/callback.routes";
import googleStatusRoutes from "./routes/google/status.routes";
import doctorRouter from "./routes/doctor";
import userRouter from "./routes/user";

const app = express();

const port = process.env.PORT ? Number(process.env.PORT) : 5000;
const allowedOrigins = [
    "https://niriava.netlify.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://niraiva-app.vercel.app", // Legacy
];

app.use(
    cors({
        origin: function (origin, callback) {
            // allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith(".netlify.app")) {
                callback(null, true);
            } else {
                console.warn(`🚨 CORS blocked for origin: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
        exposedHeaders: ['Content-Type'],
        maxAge: 3600,
    })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`, {
        origin: req.get('origin'),
        auth: req.get('authorization') ? 'present' : 'missing',
    });
    next();
});

// Base ok route
app.get("/", (_req, res) => {
    res.send("Niraiva API Running");
});

app.get("/test-cors", (_req, res) => {
    res.json({ message: "CORS test successful", timestamp: new Date().toISOString() });
});

console.log("📍 Registering routes...");

// Protected FHIR endpoints
app.use("/fhir", verifyToken, fhirRouter);
console.log("✅ /fhir routes registered");

// Protected FHIR Sync endpoints
app.use("/api/fhir", verifyToken, fhirSyncRouter);
console.log("✅ /api/fhir (sync) routes registered");

// Register the upload endpoints (handles /api/upload-report)
// Keep the existing uploadRouter (provides /api/upload)
app.use("/api", uploadRouter);
// Register the heavy OCR/pdf/Gemini route at the same /api prefix — it defines /upload-report
app.use("/api", uploadReportRouter);
console.log("✅ /api/upload and /api/upload-report routes registered");

// Reports API (latest report fetch)
app.use("/api/reports", reportsRouter);
console.log("✅ /api/reports routes registered");

// Demo endpoints - Removed for production
// app.use("/demo", demoRouter);
console.log("✅ /demo routes registered");

// Google OAuth Routes (Gmail & Drive Import)
// OAuth start routes - no auth required (user will auth with Google)
app.use("/api/google/gmail", gmailRoutes);
app.use("/api/google/drive", driveRoutes);
app.use("/api/google/callback", googleCallbackRoutes);

// Protected routes - require Niraiva authentication
app.use("/api/google/status", verifyToken, googleStatusRoutes);
app.use("/api/google/gmail", verifyToken, gmailListRoutes);
app.use("/api/google/gmail", verifyToken, gmailImportRoutes);
app.use("/api/google/drive", verifyToken, driveListRoutes);
app.use("/api/google/drive", verifyToken, driveImportRoutes);
console.log("✅ /api/google routes registered");

// ABHA API endpoints (Protected)
app.use("/api/abha", verifyToken, abhaRouter);
console.log("✅ /api/abha routes registered");

// Health check
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Doctor Portal API (Protected)
app.use("/api/doctor", verifyToken, doctorRouter);
app.use("/api/user", verifyToken, userRouter);
console.log("✅ /api/doctor and /api/user routes registered");

// ABHA-specific error handler (must be after ABHA routes)
import { abhaErrorHandler } from "./middleware/errorHandler";
app.use("/api/abha", abhaErrorHandler);

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
        error: "Internal server error",
    });
});

app.listen(port, () => {
    console.log(`🚀 Backend running on http://localhost:${port}`);
});

export default app;
