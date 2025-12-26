import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

/**
 * Zod schemas for ABHA API request validation
 */

export const verifyMobileSchema = z.object({
    body: z.object({
        mobile: z
            .string()
            .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
    }),
});

export const verifyAadharSchema = z.object({
    body: z.object({
        aadhar: z
            .string()
            .regex(/^\d{12}$/, "Aadhar number must be exactly 12 digits"),
    }),
});

export const verifyOTPSchema = z.object({
    body: z.object({
        txnId: z.string().min(1, "Transaction ID is required"),
        otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
        mobile: z
            .string()
            .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits")
            .optional(),
    }),
});

/**
 * Validation middleware factory
 * Creates Express middleware that validates requests against a Zod schema
 */
export const validate = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: error.issues.map((err) => ({
                        field: err.path.join("."),
                        message: err.message,
                    })),
                });
            }
            next(error);
        }
    };
};
