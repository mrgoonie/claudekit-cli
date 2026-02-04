/**
 * Internal types for claudekit-data domain
 */
import type { RegisteredProject } from "@/types";

export interface AddProjectOptions {
	alias?: string;
	tags?: string[];
	pinned?: boolean;
}

export interface UpdateProjectOptions {
	alias?: string;
	tags?: string[];
	pinned?: boolean;
}

export interface ProjectFilter {
	pinned?: boolean;
	tags?: string[];
}

export interface ProjectSearchResult {
	project: RegisteredProject;
	matchType: "id" | "alias" | "path";
}
