/**
 * Role-based access control middleware
 * Validates user role against required roles
 */
import { NextFunction, Request, Response } from "express";

/**
 * Middleware factory to require specific user roles
 * @param roles - Array of allowed role names
 * @returns Middleware function
 */
export const requireRole = (roles: string[] = []) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // User should be attached by authenticateUser/verifyToken middleware
            if (!req.user) {
                return res.status(401).json({
                    error: "Unauthorized",
                    message: "User not authenticated"
                });
            }

            // If no specific roles required, allow authenticated user
            if (!roles || roles.length === 0) {
                return next();
            }

            // Check if user's role is in allowed roles
            const userRole = req.user.role || req.user.user_metadata?.role;

            if (!userRole || !roles.includes(userRole)) {
                return res.status(403).json({
                    error: "Forbidden",
                    message: `User role '${userRole}' is not allowed. Required roles: ${roles.join(", ")}`
                });
            }

            return next();
        } catch (error) {
            console.error("Role guard error:", error);
            return res.status(500).json({
                error: "Internal server error",
                message: "Failed to validate user role"
            });
        }
    };
};

export default requireRole;
