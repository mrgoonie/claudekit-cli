/**
 * Global error handler middleware
 */

import { logger } from "@/shared/logger.js";
import type { NextFunction, Request, Response } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
	logger.error(`API Error: ${err.message}`);
	logger.debug(err.stack || "No stack trace");

	const statusCode = (err as Error & { statusCode?: number }).statusCode || 500;
	const message = process.env.NODE_ENV === "production" ? "Internal server error" : err.message;

	res.status(statusCode).json({
		error: true,
		message,
		...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
	});
}
