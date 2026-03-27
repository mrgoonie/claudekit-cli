/**
 * ClaudeKit API types and Zod schemas
 * Response schemas for API endpoints and command option schemas
 */

import { z } from "zod";

// --- API Response Schemas ---

export const RateLimitInfoSchema = z.object({
	limit: z.number(),
	remaining: z.number(),
	reset: z.number(),
	retryAfter: z.number().optional(),
});
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;

export const ValidationResultSchema = z.object({
	valid: z.boolean(),
	userId: z.string().optional(),
	rateLimit: z.number().optional(),
	isActive: z.boolean().optional(),
	error: z.string().optional(),
});
export type CkApiValidationResult = z.infer<typeof ValidationResultSchema>;

export const ServiceSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		description: z.string().optional(),
		baseUrl: z.string().optional(),
		timeout: z.number().optional(),
		allowedPaths: z.array(z.string()).optional(),
	})
	.passthrough();
export type Service = z.infer<typeof ServiceSchema>;

export const ServicesListSchema = z
	.object({
		services: z.array(ServiceSchema),
		usage: z.unknown().optional(),
	})
	.passthrough();
export type ServicesList = z.infer<typeof ServicesListSchema>;

export const ProxyResponseSchema = z.object({
	success: z.boolean().optional(),
	data: z.unknown(),
	error: z.string().optional(),
});
export type ProxyResponse = z.infer<typeof ProxyResponseSchema>;

export const ApiErrorResponseSchema = z.object({
	error: z.string().optional(),
	code: z.string().optional(),
	message: z.string().optional(),
	retryAfter: z.number().optional(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// --- Command Option Schemas ---

export const ApiStatusOptionsSchema = z.object({
	json: z.boolean().optional(),
});
export type ApiStatusOptions = z.infer<typeof ApiStatusOptionsSchema>;

export const ApiServicesOptionsSchema = z.object({
	json: z.boolean().optional(),
});
export type ApiServicesOptions = z.infer<typeof ApiServicesOptionsSchema>;

export const ApiProxyOptionsSchema = z.object({
	method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
	body: z.string().optional(),
	query: z.string().optional(),
	json: z.boolean().optional(),
});
export type ApiProxyOptions = z.infer<typeof ApiProxyOptionsSchema>;

export const ApiSetupOptionsSchema = z.object({
	key: z.string().optional(),
	force: z.boolean().optional(),
});
export type ApiSetupOptions = z.infer<typeof ApiSetupOptionsSchema>;

// --- Service-specific Option Schemas ---

export const VidcapOptionsSchema = z.object({
	json: z.boolean().optional(),
	locale: z.string().optional(),
	maxResults: z.number().optional(),
	second: z.string().optional(),
	order: z.enum(["time", "relevance"]).optional(),
});
export type VidcapOptions = z.infer<typeof VidcapOptionsSchema>;

export const ReviewwebOptionsSchema = z.object({
	json: z.boolean().optional(),
	format: z.enum(["bullet", "paragraph"]).optional(),
	maxLength: z.number().optional(),
	instructions: z.string().optional(),
	template: z.string().optional(),
	type: z.enum(["web", "image", "file", "all"]).optional(),
	country: z.string().optional(),
});
export type ReviewwebOptions = z.infer<typeof ReviewwebOptionsSchema>;
