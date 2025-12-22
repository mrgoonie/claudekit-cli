/**
 * Project Manager - Manages user's project list for Control Center
 * Projects stored in ~/.claude/.ck-projects.json
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";

export interface ManagedProject {
	id: string;
	path: string;
	name: string;
	addedAt: string;
}

export interface ProjectSuggestion {
	path: string;
	name: string;
	lastUsed: Date;
}

const PROJECTS_FILENAME = ".ck-projects.json";

/**
 * Get the path to the projects list file
 */
function getProjectsFilePath(): string {
	return join(PathResolver.getGlobalKitDir(), PROJECTS_FILENAME);
}

/**
 * Generate a simple UUID v4
 */
function generateId(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Load managed projects from disk
 */
export async function loadProjects(): Promise<ManagedProject[]> {
	const filePath = getProjectsFilePath();

	if (!existsSync(filePath)) {
		return [];
	}

	try {
		const content = await readFile(filePath, "utf-8");
		const data = JSON.parse(content) as { projects: ManagedProject[] };
		return data.projects || [];
	} catch (error) {
		logger.error(`Failed to load projects: ${error}`);
		return [];
	}
}

/**
 * Save managed projects to disk
 */
export async function saveProjects(projects: ManagedProject[]): Promise<void> {
	const filePath = getProjectsFilePath();
	const dirPath = dirname(filePath);

	// Ensure directory exists
	if (!existsSync(dirPath)) {
		await mkdir(dirPath, { recursive: true });
	}

	const data = { projects };
	await writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Add a project to the managed list
 */
export async function addProject(path: string, name?: string): Promise<ManagedProject> {
	const projects = await loadProjects();

	// Check if project already exists
	const existing = projects.find((p) => p.path === path);
	if (existing) {
		return existing;
	}

	const project: ManagedProject = {
		id: generateId(),
		path,
		name: name || extractProjectName(path),
		addedAt: new Date().toISOString(),
	};

	projects.push(project);
	await saveProjects(projects);

	return project;
}

/**
 * Remove a project from the managed list
 */
export async function removeProject(id: string): Promise<boolean> {
	const projects = await loadProjects();
	const index = projects.findIndex((p) => p.id === id);

	if (index === -1) {
		return false;
	}

	projects.splice(index, 1);
	await saveProjects(projects);

	return true;
}

/**
 * Get project suggestions from ~/.claude/projects/
 * Returns top 10 most recently used projects
 */
export async function getSuggestions(): Promise<ProjectSuggestion[]> {
	const projectsDir = join(PathResolver.getGlobalKitDir(), "projects");

	if (!existsSync(projectsDir)) {
		return [];
	}

	try {
		const entries = await readdir(projectsDir);
		const suggestions: ProjectSuggestion[] = [];

		for (const entry of entries) {
			const entryPath = join(projectsDir, entry);
			const stats = await stat(entryPath);

			if (stats.isDirectory()) {
				const decodedPath = decodeProjectSlug(entry);
				suggestions.push({
					path: decodedPath,
					name: extractProjectName(decodedPath),
					lastUsed: stats.mtime,
				});
			}
		}

		// Sort by last used (most recent first) and limit to 10
		return suggestions.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime()).slice(0, 10);
	} catch (error) {
		logger.error(`Failed to get project suggestions: ${error}`);
		return [];
	}
}

/**
 * Decode a project slug to its original path
 * Example: "-home-kai-project" -> "/home/kai/project"
 */
export function decodeProjectSlug(slug: string): string {
	// Replace leading dash and internal dashes with slashes
	return slug.replace(/^-/, "/").replace(/-/g, "/");
}

/**
 * Encode a project path to a slug
 * Example: "/home/kai/project" -> "-home-kai-project"
 */
export function encodeProjectSlug(path: string): string {
	return path.replace(/\//g, "-");
}

/**
 * Extract project name from path
 */
function extractProjectName(path: string): string {
	const parts = path.split("/").filter(Boolean);
	return parts[parts.length - 1] || path;
}
