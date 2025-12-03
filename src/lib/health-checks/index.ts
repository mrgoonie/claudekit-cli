/**
 * Health Checks Module
 *
 * Unified health check system for ClaudeKit CLI.
 * Provides domain-grouped checks with auto-heal capability.
 */

// Re-export all types
export type {
	CheckGroup,
	CheckResult,
	CheckRunnerOptions,
	CheckStatus,
	CheckSummary,
	Checker,
	DiagnosticReport,
	ErrorDetail,
	FixAction,
	FixAttempt,
	FixResult,
	HealingSummary,
	ReportOptions,
	SystemInfo,
} from "./types.js";

// Re-export Zod schemas
export {
	CheckGroupSchema,
	CheckResultSchema,
	CheckRunnerOptionsSchema,
	CheckStatusSchema,
	CheckSummarySchema,
	FixAttemptSchema,
	FixResultSchema,
	HealingSummarySchema,
} from "./types.js";

// Re-export CheckRunner class
export { CheckRunner } from "./check-runner.js";

// Re-export domain-specific checkers
export { SystemChecker } from "./system-checker.js";
export { ClaudekitChecker } from "./claudekit-checker.js";
export { AuthChecker } from "./auth-checker.js";

// Re-export AutoHealer
export { AutoHealer } from "./auto-healer.js";

// Re-export ReportGenerator
export { ReportGenerator } from "./report-generator.js";

// Re-export DoctorUIRenderer
export { DoctorUIRenderer } from "./doctor-ui-renderer.js";
