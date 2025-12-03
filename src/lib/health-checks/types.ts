import { z } from "zod";

/**
 * Health check status levels (aligned with npm doctor / RN CLI patterns)
 */
export type CheckStatus = "pass" | "warn" | "fail" | "info";

/**
 * Domain groups for organizing health checks
 */
export type CheckGroup = "system" | "claudekit" | "auth";

/**
 * Fix result returned by FixAction.execute()
 */
export interface FixResult {
	success: boolean;
	message: string;
	details?: string;
}

/**
 * Fix action attached to failed checks for auto-heal capability
 */
export interface FixAction {
	id: string;
	description: string;
	execute: () => Promise<FixResult>;
}

/**
 * Individual health check result
 */
export interface CheckResult {
	id: string; // Unique identifier (e.g., 'node-version')
	name: string; // Display name
	group: CheckGroup; // Domain grouping
	status: CheckStatus;
	message: string;
	details?: string;
	suggestion?: string;
	autoFixable: boolean;
	fix?: FixAction; // Attached fix function (only if autoFixable)
	fixed?: boolean; // Set after fix attempted
	fixError?: string; // Error message if fix failed
}

/**
 * Runner mode options for CLI flags
 */
export interface CheckRunnerOptions {
	fix?: boolean; // Execute fixes automatically (--fix)
	checkOnly?: boolean; // No prompts, CI mode (--check-only)
	json?: boolean; // JSON output (--json)
	groups?: CheckGroup[]; // Filter by group
	verbose?: boolean; // Detailed output
}

/**
 * Aggregated report summary
 */
export interface CheckSummary {
	timestamp: string; // ISO 8601
	total: number;
	passed: number;
	warnings: number;
	failed: number;
	fixed: number;
	checks: CheckResult[];
}

/**
 * Checker interface - implemented by domain-specific checkers
 */
export interface Checker {
	group: CheckGroup;
	run(): Promise<CheckResult[]>;
}

/**
 * Individual fix attempt result (used by AutoHealer)
 */
export interface FixAttempt {
	checkId: string;
	checkName: string;
	fixId: string;
	success: boolean;
	message: string;
	error?: string;
	duration: number; // milliseconds
}

/**
 * Summary of auto-heal execution
 */
export interface HealingSummary {
	totalFixable: number;
	attempted: number;
	succeeded: number;
	failed: number;
	fixes: FixAttempt[];
}

/**
 * Report generation options
 */
export interface ReportOptions {
	format: "text" | "json";
	includeSystemInfo: boolean;
	uploadGist?: boolean;
}

/**
 * System information for diagnostic report
 */
export interface SystemInfo {
	os: string;
	osVersion: string;
	node: string;
	npm?: string;
	cwd: string;
	cliVersion: string;
}

/**
 * Error detail for report
 */
export interface ErrorDetail {
	checkId: string;
	checkName: string;
	message: string;
	suggestion?: string;
}

/**
 * Full diagnostic report structure
 */
export interface DiagnosticReport {
	version: string;
	timestamp: string;
	system: SystemInfo;
	summary: Omit<CheckSummary, "checks"> & { checks: Omit<CheckResult, "fix">[] };
	errors: ErrorDetail[];
}

// --- Zod Schemas for runtime validation ---

export const CheckStatusSchema = z.enum(["pass", "warn", "fail", "info"]);

export const CheckGroupSchema = z.enum(["system", "claudekit", "auth"]);

export const FixResultSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	details: z.string().optional(),
});

export const CheckResultSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	group: CheckGroupSchema,
	status: CheckStatusSchema,
	message: z.string(),
	details: z.string().optional(),
	suggestion: z.string().optional(),
	autoFixable: z.boolean(),
	// fix cannot be validated by Zod (function)
	fixed: z.boolean().optional(),
	fixError: z.string().optional(),
});

export const CheckRunnerOptionsSchema = z.object({
	fix: z.boolean().optional(),
	checkOnly: z.boolean().optional(),
	json: z.boolean().optional(),
	groups: z.array(CheckGroupSchema).optional(),
	verbose: z.boolean().optional(),
});

export const CheckSummarySchema = z.object({
	timestamp: z.string().datetime(),
	total: z.number().int().nonnegative(),
	passed: z.number().int().nonnegative(),
	warnings: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	fixed: z.number().int().nonnegative(),
	checks: z.array(CheckResultSchema),
});

export const FixAttemptSchema = z.object({
	checkId: z.string().min(1),
	checkName: z.string().min(1),
	fixId: z.string().min(1),
	success: z.boolean(),
	message: z.string(),
	error: z.string().optional(),
	duration: z.number().nonnegative(),
});

export const HealingSummarySchema = z.object({
	totalFixable: z.number().int().nonnegative(),
	attempted: z.number().int().nonnegative(),
	succeeded: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	fixes: z.array(FixAttemptSchema),
});
