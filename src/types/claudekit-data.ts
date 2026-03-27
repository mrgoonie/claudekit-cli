/**
 * ClaudeKit CLI data types for ~/.claudekit/ directory
 */
import { z } from "zod";

// Project action preferences (dashboard quick actions)
export const ProjectActionPreferencesSchema = z.object({
	terminalApp: z.string().min(1).optional(),
	editorApp: z.string().min(1).optional(),
});

export type ProjectActionPreferences = z.infer<typeof ProjectActionPreferencesSchema>;

// Registered project schema
export const RegisteredProjectSchema = z.object({
	id: z.string().uuid(),
	path: z.string().min(1),
	alias: z.string().min(1),
	addedAt: z.string().datetime(),
	lastOpened: z.string().datetime().optional(),
	pinned: z.boolean().optional(),
	tags: z.array(z.string()).optional(),
	preferences: ProjectActionPreferencesSchema.optional(),
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
