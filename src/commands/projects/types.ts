/**
 * Projects command types
 */

export interface ProjectsListOptions {
	json?: boolean;
	pinned?: boolean;
}

export interface ProjectsAddOptions {
	alias?: string;
	pinned?: boolean;
	tags?: string;
}

export interface ProjectsRemoveOptions {
	id?: string;
}
