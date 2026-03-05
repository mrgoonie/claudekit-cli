/**
 * ClaudeKit data domain
 * Manages ~/.claudekit/ directory contents
 */
export { ProjectsRegistryManager } from "./projects-registry.js";
export {
	scanClaudeProjects,
	isClaudeProject,
	type DiscoveredProject,
} from "./claude-projects-scanner.js";
export type { AddProjectOptions, UpdateProjectOptions, ProjectFilter } from "./types.js";
