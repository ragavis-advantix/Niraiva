import type { Request, Response, NextFunction } from "express";
import type { ABHAError } from "../types/abha.types";

/**
 * Centralized error handling middleware for ABHA routes
 */
export const abhaErrorHandler = (
    err: ABHAError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Log the error for debugging
    console.error("ABHA Error:", {
        message: err.message,
        status: err.status,
        code: err.code,
        details: err.details,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
    });

    // Determine status code
    const statusCode = err.status || 500;

    // Send error response
    res.status(statusCode).json({
        success: false,
        error: {
            message: err.message || "An error occurred",
            code: err.code || "UNKNOWN_ERROR",
            status: statusCode,
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === "development" && err.details
                ? { details: err.details }
                : {}),
        },
    });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
