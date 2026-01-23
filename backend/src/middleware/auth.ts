/**
 * Authentication middleware
 * Wraps around verifyToken with export name match
 */
import { NextFunction, Request, Response } from "express";
import { verifyToken } from "./verifyToken";

// Export verifyToken as authenticateUser for compatibility
export const authenticateUser = verifyToken;

// Export as default too
export default authenticateUser;
