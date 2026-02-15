/**
 * Internal types for claudekit-data domain
 */
import type { ProjectActionPreferences, RegisteredProject } from "@/types";

export interface AddProjectOptions {
	alias?: string;
	tags?: string[];
	pinned?: boolean;
	preferences?: ProjectActionPreferences;
}

export interface UpdateProjectOptions {
	alias?: string;
	tags?: string[];
	pinned?: boolean;
	preferences?: {
		terminalApp?: string | null;
		editorApp?: string | null;
	} | null;
}

export interface ProjectFilter {
	pinned?: boolean;
	tags?: string[];
}

export interface ProjectSearchResult {
	project: RegisteredProject;
	matchType: "id" | "alias" | "path";
}
