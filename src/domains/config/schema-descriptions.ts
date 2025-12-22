import { z } from "zod";

/**
 * Extended config schema with descriptions for help/schema commands
 */
export const ConfigSchemaWithDescriptions = z.object({
	defaults: z
		.object({
			kit: z
				.string()
				.describe("Default kit to use (engineer, marketing)")
				.default("engineer"),
			dir: z
				.string()
				.describe("Default target directory for new projects")
				.default("."),
		})
		.describe("Default values for CLI commands")
		.optional(),

	folders: z
		.object({
			docs: z.string().describe("Documentation directory name").default("docs"),
			plans: z.string().describe("Plans directory name").default("plans"),
		})
		.describe("Folder naming configuration")
		.optional(),

	github: z
		.object({
			token: z.string().describe("GitHub personal access token (stored in keychain)").optional(),
		})
		.describe("GitHub authentication settings")
		.optional(),
});

/**
 * Get schema as JSON Schema for `ck config schema`
 */
export function getJsonSchema(): Record<string, unknown> {
	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		title: "ClaudeKit Configuration",
		type: "object",
		properties: {
			defaults: {
				type: "object",
				description: "Default values for CLI commands",
				properties: {
					kit: {
						type: "string",
						description: "Default kit to use (engineer, marketing)",
						default: "engineer",
						enum: ["engineer", "marketing"],
					},
					dir: {
						type: "string",
						description: "Default target directory for new projects",
						default: ".",
					},
				},
			},
			folders: {
				type: "object",
				description: "Folder naming configuration",
				properties: {
					docs: {
						type: "string",
						description: "Documentation directory name",
						default: "docs",
					},
					plans: {
						type: "string",
						description: "Plans directory name",
						default: "plans",
					},
				},
			},
			github: {
				type: "object",
				description: "GitHub authentication settings",
				properties: {
					token: {
						type: "string",
						description: "GitHub personal access token (stored in keychain)",
					},
				},
			},
		},
	};
}

/**
 * Get human-readable schema description for CLI
 */
export function getSchemaDescription(): string {
	return `
ClaudeKit Configuration Schema
==============================

DEFAULTS:
  defaults.kit     Default kit to use (engineer, marketing)
  defaults.dir     Default target directory for new projects

FOLDERS:
  folders.docs     Documentation directory name (default: "docs")
  folders.plans    Plans directory name (default: "plans")

GITHUB:
  github.token     GitHub personal access token (stored in keychain)

LOCATIONS:
  Global:  ~/.claudekit/config.json
  Local:   ./.claude/.ck.json
`.trim();
}
