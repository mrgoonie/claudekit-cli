/**
 * ClaudeKit CLI data types for ~/.claudekit/ directory
 */
import { z } from "zod";

// ClaudeKit config schema (~/.claudekit/config.json)
export const ClaudeKitConfigSchema = z.object({
	defaults: z
		.object({
			kit: z.string().optional(),
			editor: z.string().optional(),
		})
		.optional(),
	ui: z
		.object({
			theme: z.enum(["light", "dark", "system"]).optional(),
			lastPort: z.number().int().positive().optional(),
		})
		.optional(),
	telemetry: z.boolean().optional(),
	updateCheck: z
		.object({
			enabled: z.boolean(),
			lastChecked: z.string().datetime().optional(),
		})
		.optional(),
});

export type ClaudeKitConfig = z.infer<typeof ClaudeKitConfigSchema>;

// Registered project schema
export const RegisteredProjectSchema = z.object({
	id: z.string().uuid(),
	path: z.string().min(1),
	alias: z.string().min(1),
	addedAt: z.string().datetime(),
	lastOpened: z.string().datetime().optional(),
	pinned: z.boolean().optional(),
	tags: z.array(z.string()).optional(),
});

export type RegisteredProject = z.infer<typeof RegisteredProjectSchema>;

// Projects registry schema (~/.claudekit/projects.json)
export const ProjectsRegistrySchema = z.object({
	version: z.number().int().positive(),
	projects: z.array(RegisteredProjectSchema),
});

export type ProjectsRegistry = z.infer<typeof ProjectsRegistrySchema>;

// Default empty registry
export const DEFAULT_PROJECTS_REGISTRY: ProjectsRegistry = {
	version: 1,
	projects: [],
};

// Default config
export const DEFAULT_CLAUDEKIT_CONFIG: ClaudeKitConfig = {
	defaults: {},
	ui: {},
	telemetry: false,
	updateCheck: { enabled: true },
};
