import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { verifyToken } from "./middleware/verifyToken";
import { fhirRouter } from "./routes/fhir";
// import { demoRouter } from "./routes/demo"; // Removed for production
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
import authRouter from "./routes/auth";
import timelineRouter from "./modules/timeline/timeline.routes";

const app = express();

const port = process.env.PORT ? Number(process.env.PORT) : 5000;

// Environment-aware CORS configuration
const allowedOrigins = [
    // Local development
    "http://localhost:5173",
    "http://localhost:3000",
    // Production - Netlify
    "https://niriava.netlify.app",
    // Legacy/preview builds
    "https://695a9db4562490a60c06fb56--niriava.netlify.app",
    // Fallback (if needed)
    "https://niraiva-app.vercel.app",
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

// 🔴 ENHANCED LOGGING MIDDLEWARE - Tracks all requests and responses
app.use((req, res, next) => {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Log incoming request with full details
    console.log(`\n📥 [${requestId}] >>> ${req.method.toUpperCase()} ${req.path}`);
    console.log(`   Headers:`, {
        'content-type': req.get('content-type'),
        'auth': req.get('authorization') ? '✅ Bearer' : '❌ None',
        'origin': req.get('origin'),
    });
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        console.log(`   Body keys:`, Object.keys(req.body));
    }

    // Track response
    const originalEnd = res.end.bind(res);
    res.end = function (...args: any[]) {
        const duration = Date.now() - startTime;
        console.log(`📤 [${requestId}] <<< ${res.statusCode} (${duration}ms)`);
        return originalEnd(...args);
    } as any;

    next();
});

// Health check endpoints
app.get("/", (_req, res) => {
    res.json({
        status: "ok",
        service: "Niraiva Backend",
        timestamp: new Date().toISOString(),
    });
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
app.use("/api/auth", authRouter);
app.use("/api/timeline", verifyToken, timelineRouter);
console.log("✅ /api/doctor, /api/user, and /api/timeline routes registered");

import chatRouter from "./routes/chat";
app.use("/api/chat", verifyToken, chatRouter);
console.log("✅ /api/chat routes registered");

import diagnosticPathwayRouter from "./routes/diagnostic-pathway";
app.use("/api/diagnostic-pathway", verifyToken, diagnosticPathwayRouter);
console.log("✅ /api/diagnostic-pathway routes registered");

import backfillRouter from "./routes/backfill";
app.use("/api/backfill", backfillRouter);  // No auth - one-time admin operation
console.log("✅ /api/backfill routes registered");

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
    const isProduction = process.env.NODE_ENV === "production";
    const url = isProduction
        ? `https://niraiva.onrender.com`
        : `http://localhost:${port}`;
    console.log(`🚀 Niraiva Backend running on ${url} (PORT=${port}, ENV=${process.env.NODE_ENV || "development"})`);
});

export default app;
