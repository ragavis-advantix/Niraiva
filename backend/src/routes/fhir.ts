import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
    fhirGet,
    fhirPost,
    fhirPut,
    fhirDelete,
    type FhirResource,
    type FhirBundle,
    type FhirResponse,
} from "../lib/fhirClient";
import {
    getPatientIdFromRequest,
    filterBundleByPatient,
    isResourceOwnedByPatient,
} from "../lib/patientAccess";

const router = Router();

// Async error handler wrapper
const asyncHandler = (
    handler: (req: Request, res: Response, next?: NextFunction) => any
) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

/**
 * Send FHIR response with proper status codes and content type
 */
const sendFhirResponse = (res: Response, fhirResponse: FhirResponse<unknown>) => {
    res.status(fhirResponse.status);

    if (!fhirResponse.ok && fhirResponse.error) {
        res.json({
            resourceType: "OperationOutcome",
            issue: [
                {
                    severity: "error",
                    code: "processing",
                    diagnostics: fhirResponse.error,
                },
            ],
        });
        return;
    }

    if (fhirResponse.data) {
        res.json(fhirResponse.data);
    } else {
        res.json({});
    }
};

/**
 * Validate patient ownership before returning resource
 */
const validatePatientOwnershipMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const patientId = getPatientIdFromRequest(req);
    if (!patientId) {
        res.status(401).json({ error: "Patient ID not found in token" });
        return;
    }

    (req as any).patientId = patientId;
    next();
};

// ============= PATIENT ENDPOINTS =============

/**
 * GET /fhir/Patient/:id
 * Get patient profile (only own profile)
 */
router.get(
    "/Patient/:id",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req, res) => {
        const patientId = (req as any).patientId;
        const requestedId = req.params.id;

        // Patient can only access their own profile
        if (requestedId !== patientId) {
            return res.status(403).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "forbidden",
                        diagnostics: "You can only access your own patient profile",
                    },
                ],
            });
        }

        const response = await fhirGet<FhirResource>(`Patient/${requestedId}`);
        sendFhirResponse(res, response);
    })
);

/**
 * POST /fhir/Patient
 * Create patient (for testing only, usually done by system)
 */
router.post(
    "/Patient",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientData: FhirResource = req.body;

        // Ensure resourceType is Patient
        if (patientData.resourceType !== "Patient") {
            return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "invalid",
                        diagnostics: "Resource type must be Patient",
                    },
                ],
            });
        }

        const response = await fhirPost<FhirResource>("Patient", patientData);
        sendFhirResponse(res, response);
    })
);

/**
 * PUT /fhir/Patient/:id
 * Update patient profile (only own profile)
 */
router.put(
    "/Patient/:id",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const requestedId = req.params.id;

        // Patient can only update their own profile
        if (requestedId !== patientId) {
            return res.status(403).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "forbidden",
                        diagnostics: "You can only update your own patient profile",
                    },
                ],
            });
        }

        const response = await fhirPut<FhirResource>(
            `Patient/${requestedId}`,
            req.body
        );
        sendFhirResponse(res, response);
    })
);

// ============= OBSERVATION ENDPOINTS =============

/**
 * GET /fhir/Observation
 * Get all observations for patient (filtered by subject)
 */
router.get(
    "/Observation",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;

        // Query for observations where subject = this patient
        const queryParams = {
            subject: `Patient/${patientId}`,
            ...req.query,
        };

        const response = await fhirGet<FhirBundle>("Observation", queryParams as Record<string, string | string[]>);

        // Double-check: filter bundle results to ensure only patient's data
        if (response.ok && response.data?.entry) {
            response.data = filterBundleByPatient(
                response.data as FhirBundle,
                patientId
            );
        }

        sendFhirResponse(res, response);
    })
);

/**
 * GET /fhir/Observation/:id
 * Get specific observation (verify ownership)
 */
router.get(
    "/Observation/:id",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const observationId = req.params.id;

        const response = await fhirGet<FhirResource>(
            `Observation/${observationId}`
        );

        // Verify ownership
        if (response.ok && response.data) {
            const isOwned = isResourceOwnedByPatient(response.data, patientId);
            if (!isOwned) {
                return res.status(403).json({
                    resourceType: "OperationOutcome",
                    issue: [
                        {
                            severity: "error",
                            code: "forbidden",
                            diagnostics: "This observation does not belong to you",
                        },
                    ],
                });
            }
        }

        sendFhirResponse(res, response);
    })
);

/**
 * POST /fhir/Observation
 * Create observation (vitals, blood pressure, etc.)
 */
router.post(
    "/Observation",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const observationData: FhirResource = req.body;

        // Ensure resourceType is Observation
        if (observationData.resourceType !== "Observation") {
            return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "invalid",
                        diagnostics: "Resource type must be Observation",
                    },
                ],
            });
        }

        // Ensure observation is for this patient
        const subject = (observationData as any).subject;
        const subjectRef =
            typeof subject === "string"
                ? subject
                : (subject as any)?.reference;

        if (
            subjectRef !== `Patient/${patientId}` &&
            subjectRef !== patientId
        ) {
            return res.status(403).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "forbidden",
                        diagnostics: "Observation must be for the authenticated patient",
                    },
                ],
            });
        }

        const response = await fhirPost<FhirResource>(
            "Observation",
            observationData
        );
        sendFhirResponse(res, response);
    })
);

// ============= CONDITION ENDPOINTS =============

/**
 * GET /fhir/Condition
 * Get all conditions for patient
 */
router.get(
    "/Condition",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;

        const queryParams = {
            subject: `Patient/${patientId}`,
            ...req.query,
        };

        const response = await fhirGet<FhirBundle>("Condition", queryParams as Record<string, string | string[]>);

        if (response.ok && response.data?.entry) {
            response.data = filterBundleByPatient(
                response.data as FhirBundle,
                patientId
            );
        }

        sendFhirResponse(res, response);
    })
);

/**
 * GET /fhir/Condition/:id
 * Get specific condition (verify ownership)
 */
router.get(
    "/Condition/:id",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const conditionId = req.params.id;

        const response = await fhirGet<FhirResource>(
            `Condition/${conditionId}`
        );

        if (response.ok && response.data) {
            const isOwned = isResourceOwnedByPatient(response.data, patientId);
            if (!isOwned) {
                return res.status(403).json({
                    resourceType: "OperationOutcome",
                    issue: [
                        {
                            severity: "error",
                            code: "forbidden",
                            diagnostics: "This condition does not belong to you",
                        },
                    ],
                });
            }
        }

        sendFhirResponse(res, response);
    })
);

/**
 * POST /fhir/Condition
 * Create condition (diagnosis)
 */
router.post(
    "/Condition",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const conditionData: FhirResource = req.body;

        if (conditionData.resourceType !== "Condition") {
            return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "invalid",
                        diagnostics: "Resource type must be Condition",
                    },
                ],
            });
        }

        const subject = (conditionData as any).subject;
        const subjectRef =
            typeof subject === "string"
                ? subject
                : (subject as any)?.reference;

        if (
            subjectRef !== `Patient/${patientId}` &&
            subjectRef !== patientId
        ) {
            return res.status(403).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "forbidden",
                        diagnostics: "Condition must be for the authenticated patient",
                    },
                ],
            });
        }

        const response = await fhirPost<FhirResource>(
            "Condition",
            conditionData
        );
        sendFhirResponse(res, response);
    })
);

// ============= MEDICATION REQUEST ENDPOINTS =============

/**
 * GET /fhir/MedicationRequest
 * Get all medication requests for patient
 */
router.get(
    "/MedicationRequest",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;

        const queryParams = {
            subject: `Patient/${patientId}`,
            ...req.query,
        };

        const response = await fhirGet<FhirBundle>(
            "MedicationRequest",
            queryParams as Record<string, string | string[]>
        );

        if (response.ok && response.data?.entry) {
            response.data = filterBundleByPatient(
                response.data as FhirBundle,
                patientId
            );
        }

        sendFhirResponse(res, response);
    })
);

/**
 * GET /fhir/MedicationRequest/:id
 * Get specific medication request
 */
router.get(
    "/MedicationRequest/:id",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const medReqId = req.params.id;

        const response = await fhirGet<FhirResource>(
            `MedicationRequest/${medReqId}`
        );

        if (response.ok && response.data) {
            const isOwned = isResourceOwnedByPatient(response.data, patientId);
            if (!isOwned) {
                return res.status(403).json({
                    resourceType: "OperationOutcome",
                    issue: [
                        {
                            severity: "error",
                            code: "forbidden",
                            diagnostics:
                                "This medication request does not belong to you",
                        },
                    ],
                });
            }
        }

        sendFhirResponse(res, response);
    })
);

/**
 * POST /fhir/MedicationRequest
 * Create medication request
 */
router.post(
    "/MedicationRequest",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const medReqData: FhirResource = req.body;

        if (medReqData.resourceType !== "MedicationRequest") {
            return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "invalid",
                        diagnostics: "Resource type must be MedicationRequest",
                    },
                ],
            });
        }

        const subject = (medReqData as any).subject;
        const subjectRef =
            typeof subject === "string"
                ? subject
                : (subject as any)?.reference;

        if (
            subjectRef !== `Patient/${patientId}` &&
            subjectRef !== patientId
        ) {
            return res.status(403).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "forbidden",
                        diagnostics:
                            "MedicationRequest must be for the authenticated patient",
                    },
                ],
            });
        }

        const response = await fhirPost<FhirResource>(
            "MedicationRequest",
            medReqData
        );
        sendFhirResponse(res, response);
    })
);

// ============= DIAGNOSTIC REPORT ENDPOINTS =============

/**
 * GET /fhir/DiagnosticReport
 * Get all diagnostic reports for patient
 */
router.get(
    "/DiagnosticReport",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;

        const queryParams = {
            subject: `Patient/${patientId}`,
            ...req.query,
        };

        const response = await fhirGet<FhirBundle>(
            "DiagnosticReport",
            queryParams as Record<string, string | string[]>
        );

        if (response.ok && response.data?.entry) {
            response.data = filterBundleByPatient(
                response.data as FhirBundle,
                patientId
            );
        }

        sendFhirResponse(res, response);
    })
);

/**
 * GET /fhir/DiagnosticReport/:id
 * Get specific diagnostic report
 */
router.get(
    "/DiagnosticReport/:id",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const reportId = req.params.id;

        const response = await fhirGet<FhirResource>(
            `DiagnosticReport/${reportId}`
        );

        if (response.ok && response.data) {
            const isOwned = isResourceOwnedByPatient(response.data, patientId);
            if (!isOwned) {
                return res.status(403).json({
                    resourceType: "OperationOutcome",
                    issue: [
                        {
                            severity: "error",
                            code: "forbidden",
                            diagnostics:
                                "This diagnostic report does not belong to you",
                        },
                    ],
                });
            }
        }

        sendFhirResponse(res, response);
    })
);

/**
 * POST /fhir/DiagnosticReport
 * Create diagnostic report
 */
router.post(
    "/DiagnosticReport",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const reportData: FhirResource = req.body;

        if (reportData.resourceType !== "DiagnosticReport") {
            return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "invalid",
                        diagnostics: "Resource type must be DiagnosticReport",
                    },
                ],
            });
        }

        const subject = (reportData as any).subject;
        const subjectRef =
            typeof subject === "string"
                ? subject
                : (subject as any)?.reference;

        if (
            subjectRef !== `Patient/${patientId}` &&
            subjectRef !== patientId
        ) {
            return res.status(403).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "forbidden",
                        diagnostics:
                            "DiagnosticReport must be for the authenticated patient",
                    },
                ],
            });
        }

        const response = await fhirPost<FhirResource>(
            "DiagnosticReport",
            reportData
        );
        sendFhirResponse(res, response);
    })
);

// ============= DOCUMENT REFERENCE ENDPOINTS =============

/**
 * GET /fhir/DocumentReference
 * Get all documents for patient
 */
router.get(
    "/DocumentReference",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;

        const queryParams = {
            subject: `Patient/${patientId}`,
            ...req.query,
        };

        const response = await fhirGet<FhirBundle>(
            "DocumentReference",
            queryParams as Record<string, string | string[]>
        );

        if (response.ok && response.data?.entry) {
            response.data = filterBundleByPatient(
                response.data as FhirBundle,
                patientId
            );
        }

        sendFhirResponse(res, response);
    })
);

/**
 * GET /fhir/DocumentReference/:id
 * Get specific document
 */
router.get(
    "/DocumentReference/:id",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const docId = req.params.id;

        const response = await fhirGet<FhirResource>(
            `DocumentReference/${docId}`
        );

        if (response.ok && response.data) {
            const isOwned = isResourceOwnedByPatient(response.data, patientId);
            if (!isOwned) {
                return res.status(403).json({
                    resourceType: "OperationOutcome",
                    issue: [
                        {
                            severity: "error",
                            code: "forbidden",
                            diagnostics:
                                "This document does not belong to you",
                        },
                    ],
                });
            }
        }

        sendFhirResponse(res, response);
    })
);

/**
 * POST /fhir/DocumentReference
 * Create document reference (for file uploads)
 */
router.post(
    "/DocumentReference",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const docData: FhirResource = req.body;

        if (docData.resourceType !== "DocumentReference") {
            return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "invalid",
                        diagnostics: "Resource type must be DocumentReference",
                    },
                ],
            });
        }

        const subject = (docData as any).subject;
        const subjectRef =
            typeof subject === "string"
                ? subject
                : (subject as any)?.reference;

        if (
            subjectRef !== `Patient/${patientId}` &&
            subjectRef !== patientId
        ) {
            return res.status(403).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "forbidden",
                        diagnostics:
                            "DocumentReference must be for the authenticated patient",
                    },
                ],
            });
        }

        const response = await fhirPost<FhirResource>(
            "DocumentReference",
            docData
        );
        sendFhirResponse(res, response);
    })
);

// ============= ENCOUNTER ENDPOINTS =============

/**
 * GET /fhir/Encounter
 * Get all encounters for patient
 */
router.get(
    "/Encounter",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;

        const queryParams = {
            subject: `Patient/${patientId}`,
            ...req.query,
        };

        const response = await fhirGet<FhirBundle>(
            "Encounter",
            queryParams as Record<string, string | string[]>
        );

        if (response.ok && response.data?.entry) {
            response.data = filterBundleByPatient(
                response.data as FhirBundle,
                patientId
            );
        }

        sendFhirResponse(res, response);
    })
);

/**
 * GET /fhir/Encounter/:id
 * Get specific encounter
 */
router.get(
    "/Encounter/:id",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const encounterId = req.params.id;

        const response = await fhirGet<FhirResource>(
            `Encounter/${encounterId}`
        );

        if (response.ok && response.data) {
            const isOwned = isResourceOwnedByPatient(response.data, patientId);
            if (!isOwned) {
                return res.status(403).json({
                    resourceType: "OperationOutcome",
                    issue: [
                        {
                            severity: "error",
                            code: "forbidden",
                            diagnostics: "This encounter does not belong to you",
                        },
                    ],
                });
            }
        }

        sendFhirResponse(res, response);
    })
);

/**
 * POST /fhir/Encounter
 * Create encounter (visit log)
 */
router.post(
    "/Encounter",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const encounterData: FhirResource = req.body;

        if (encounterData.resourceType !== "Encounter") {
            return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "invalid",
                        diagnostics: "Resource type must be Encounter",
                    },
                ],
            });
        }

        const subject = (encounterData as any).subject;
        const subjectRef =
            typeof subject === "string"
                ? subject
                : (subject as any)?.reference;

        if (
            subjectRef !== `Patient/${patientId}` &&
            subjectRef !== patientId
        ) {
            return res.status(403).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "forbidden",
                        diagnostics:
                            "Encounter must be for the authenticated patient",
                    },
                ],
            });
        }

        const response = await fhirPost<FhirResource>(
            "Encounter",
            encounterData
        );
        sendFhirResponse(res, response);
    })
);

// ============= BINARY ENDPOINTS (for file uploads) =============

/**
 * GET /fhir/Binary/:id
 * Download a binary resource (file)
 */
router.get(
    "/Binary/:id",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const binaryId = req.params.id;

        const response = await fhirGet<{ data?: string; contentType?: string }>(
            `Binary/${binaryId}`
        );

        if (response.ok && response.data) {
            res.setHeader(
                "Content-Type",
                (response.data.contentType as string) || "application/octet-stream"
            );
            res.send(response.data.data);
        } else {
            sendFhirResponse(res, response);
        }
    })
);

/**
 * POST /fhir/Binary
 * Upload a binary resource (file)
 */
router.post(
    "/Binary",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const binaryData = req.body;

        // Ensure contentType is set
        if (!binaryData.contentType) {
            return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "invalid",
                        diagnostics: "contentType is required",
                    },
                ],
            });
        }

        const response = await fhirPost<FhirResource>("Binary", binaryData);
        sendFhirResponse(res, response);
    })
);

// ============= FILE PROCESSING ENDPOINTS =============

/**
 * POST /fhir/process-file
 * Process uploaded health reports (PNG, PDF, JSON)
 * Accepts base64 encoded file content
 * Forwards to n8n webhook for processing and converts response back to Niraiva format
 */
router.post(
    "/process-file",
    validatePatientOwnershipMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const patientId = (req as any).patientId;
        const { name, type, contentBase64 } = req.body;

        // Validate required fields
        if (!name || !contentBase64) {
            return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "invalid",
                        diagnostics: "name and contentBase64 are required",
                    },
                ],
            });
        }

        // Validate file type - only PNG, PDF, JSON allowed
        const allowedTypes = [
            "image/png",
            "application/pdf",
            "application/json",
        ];

        const fileExtension = name.split(".").pop()?.toLowerCase();
        const validExtensions = ["png", "pdf", "json"];

        const isValidType =
            allowedTypes.includes(type) ||
            (fileExtension && validExtensions.includes(fileExtension));

        if (!isValidType) {
            return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "invalid",
                        diagnostics:
                            "Only PNG, PDF, and JSON files are allowed. Received: " +
                            (type || fileExtension || "unknown"),
                    },
                ],
            });
        }

        try {
            // Get the authorization token from request headers
            const authHeader = req.headers.authorization || "";

            // Determine file type for n8n
            let fileType = "pdf";
            if (fileExtension === "json") fileType = "json";
            else if (fileExtension === "png") fileType = "image";

            // Prepare payload for n8n webhook - pass file as binary data
            // n8n webhook expects the file in body with proper structure
            const n8nPayload = {
                fileName: name,
                fileType: fileType,
                contentBase64: contentBase64,
                mimeType: type || getMimeType(fileExtension),
                authorization: authHeader,
                patientId: patientId,
            };

            // Get n8n webhook URL from environment
            const webhookUrl =
                process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/Niraiva";

            console.log("Sending to n8n webhook:", webhookUrl);
            console.log("File type:", fileType);

            // Send to n8n webhook
            const n8nResponse = await fetch(webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                },
                body: JSON.stringify(n8nPayload),
            });

            if (!n8nResponse.ok) {
                const errorText = await n8nResponse.text().catch(() => "Unknown error");
                console.error("n8n webhook error:", n8nResponse.status, errorText);
                throw new Error(
                    `n8n processing failed: ${n8nResponse.status} ${errorText}`
                );
            }

            const processedData = await n8nResponse.json() as any;
            console.log("n8n response received:", processedData);

            // Check if n8n returned an error in the response
            if (processedData.error || processedData.message === "Supabase client is not configured correctly") {
                console.error("n8n error in response:", processedData.error || processedData.message);
                throw new Error(
                    processedData.message || processedData.error || "n8n processing failed"
                );
            }

            // Extract relevant data from n8n response
            // n8n returns: { user_id, patient_id, report_json, raw_text, file_type }
            const reportJson = processedData.report_json || {};
            const profileData = reportJson.data?.profile || {};
            const parameters = reportJson.data?.parameters || [];
            const medications = reportJson.data?.medications || [];
            const appointments = reportJson.data?.appointments || [];
            const conditions = reportJson.data?.conditions || [];
            const clinicalInfo = reportJson.data?.clinicalInfo || {};

            // Map n8n response to Niraiva format
            const mappedReport = {
                id: `report-${Date.now()}-${Math.random()
                    .toString(36)
                    .substr(2, 9)}`,
                name: name,
                type: type || "application/octet-stream",
                date: new Date().toISOString(),
                patientId: (processedData as any).patient_id || patientId,
                content: {
                    processingStatus: reportJson.processingStatus || "success",
                    extractedAt: reportJson.extractedAt,
                    profile: {
                        bloodType: profileData.bloodType || null,
                        allergies: profileData.allergies || [],
                        age: profileData.age || null,
                        gender: profileData.gender || null,
                        height: profileData.height || null,
                        weight: profileData.weight || null,
                        bmi: profileData.bmi || null,
                    },
                    parameters: parameters.map((p: any) => ({
                        name: p.name || "Unknown",
                        value: p.value,
                        unit: p.unit || null,
                        status: p.status || "unknown",
                        timestamp: p.timestamp || new Date().toISOString(),
                        referenceRange: p.referenceRange || null,
                        trend: p.trend || "unknown",
                        note: p.note || null,
                    })),
                    medications: medications.map((m: any) => ({
                        name: m.name || "Unknown",
                        dosage: m.dosage || null,
                        frequency: m.frequency || null,
                        startDate: m.startDate || null,
                        endDate: m.endDate || null,
                        status: m.status || "active",
                        purpose: m.purpose || null,
                        instructions: m.instructions || null,
                        sideEffects: m.sideEffects || [],
                        note: m.note || null,
                    })),
                    appointments: appointments.map((a: any) => ({
                        date: a.date || null,
                        title: a.title || "Appointment",
                        type: a.type || "regular",
                        status: a.status || "scheduled",
                        provider: {
                            name: a.provider?.name || null,
                            specialty: a.provider?.specialty || null,
                        },
                        location: a.location || null,
                        note: a.note || null,
                    })),
                    conditions: conditions.map((c: any) => ({
                        name: c.name || "Unknown",
                        severity: c.severity || "unknown",
                        status: c.status || "unknown",
                        symptoms: c.symptoms || [],
                        note: c.notes || null,
                    })),
                    allergies: clinicalInfo.allergies || [],
                    immunizations: clinicalInfo.immunizations || [],
                    lifestyle: clinicalInfo.lifestyle || null,
                },
            };

            // Create FHIR DocumentReference to store in FHIR server
            const documentReference = {
                resourceType: "DocumentReference",
                status: "current",
                docStatus: "final",
                type: {
                    coding: [
                        {
                            system: "http://loinc.org",
                            code: "34108-1",
                            display: "Outpatient note",
                        },
                    ],
                },
                subject: {
                    reference: `Patient/${patientId}`,
                },
                date: new Date().toISOString(),
                content: [
                    {
                        attachment: {
                            contentType: type,
                            title: name,
                            data: contentBase64,
                        },
                    },
                ],
            };

            // Store in FHIR server
            const fhirResponse = await fhirPost<FhirResource>(
                "DocumentReference",
                documentReference
            );

            if (!fhirResponse.ok) {
                console.error("FHIR storage warning:", fhirResponse.error);
            }

            // Return mapped report
            return res.status(200).json({
                success: true,
                message: "File processed successfully",
                mappedReport: mappedReport,
            });
        } catch (error) {
            console.error("Error processing file:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to process file";

            // If n8n fails, provide a helpful error message
            if (errorMessage.includes("Server misconfigured") || errorMessage.includes("Supabase")) {
                console.error("n8n/Supabase configuration issue detected");
                return res.status(500).json({
                    resourceType: "OperationOutcome",
                    issue: [
                        {
                            severity: "error",
                            code: "processing",
                            diagnostics: "n8n webhook service configuration error. Please ensure n8n is running and Supabase credentials are configured in n8n.",
                        },
                    ],
                });
            }

            return res.status(500).json({
                resourceType: "OperationOutcome",
                issue: [
                    {
                        severity: "error",
                        code: "processing",
                        diagnostics: errorMessage,
                    },
                ],
            });
        }
    })
);

/**
 * Helper function to get MIME type from file extension
 */
function getMimeType(extension: string | undefined): string {
    const mimeTypes: { [key: string]: string } = {
        pdf: "application/pdf",
        json: "application/json",
        png: "image/png",
    };
    return mimeTypes[extension || ""] || "application/octet-stream";
}

export const fhirRouter = router;