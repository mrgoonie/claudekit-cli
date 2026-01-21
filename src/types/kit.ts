/**
 * Kit configuration types and constants
 */
import { z } from "zod";

// Kit types
export const KitType = z.enum(["engineer", "marketing"]);
export type KitType = z.infer<typeof KitType>;

// Runtime validation helper - validates string is valid KitType before unsafe casts
export function isValidKitType(value: string): value is KitType {
	return value === "engineer" || value === "marketing";
}

// Kit configuration
export const KitConfigSchema = z.object({
	name: z.string(),
	repo: z.string(),
	owner: z.string(),
	description: z.string(),
});
export type KitConfig = z.infer<typeof KitConfigSchema>;

// Available kits
export const AVAILABLE_KITS: Record<KitType, KitConfig> = {
	engineer: {
		name: "ClaudeKit Engineer",
		repo: "claudekit-engineer",
		owner: "claudekit",
		description: "Engineering toolkit for building with Claude",
	},
	marketing: {
		name: "ClaudeKit Marketing",
		repo: "claudekit-marketing",
		owner: "claudekit",
		description: "Marketing automation toolkit for Claude",
	},
};

// Security-sensitive files that should NEVER be copied from templates
// These files may contain secrets, keys, or credentials and must never overwrite user's versions
export const NEVER_COPY_PATTERNS = [
	// Environment and secrets
	".env",
	".env.local",
	".env.*.local",
	"*.key",
	"*.pem",
	"*.p12",
	// Dependencies and build artifacts
	"node_modules/**",
	".git/**",
	"dist/**",
	"build/**",
	// Python virtual environments (prevents EMFILE on Windows with large venvs)
	".venv/**",
	"venv/**",
	"__pycache__/**",
];

// User configuration files that should only be skipped if they already exist
// On first installation, these should be copied; on updates, preserve user's version
export const USER_CONFIG_PATTERNS = [
	".gitignore",
	".repomixignore",
	".mcp.json",
	".ckignore",
	".ck.json",
	"CLAUDE.md",
];

// Combined protected patterns for backward compatibility
export const PROTECTED_PATTERNS = [...NEVER_COPY_PATTERNS, ...USER_CONFIG_PATTERNS];
