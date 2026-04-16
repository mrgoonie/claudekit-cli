import { join } from "pathe";
import type { ProjectInfo } from "../../lib/tauri-commands";

export interface DesktopScanTarget {
	rootPath: string;
	maxDepth: number;
}

export function buildDesktopScanTargets(homeDir: string): DesktopScanTarget[] {
	return [
		{ rootPath: homeDir, maxDepth: 1 },
		{ rootPath: join(homeDir, "projects"), maxDepth: 3 },
		{ rootPath: join(homeDir, "code"), maxDepth: 3 },
		{ rootPath: join(homeDir, "dev"), maxDepth: 3 },
	];
}

export function dedupeDiscoveredProjects(projects: ProjectInfo[]): ProjectInfo[] {
	const byPath = new Map<string, ProjectInfo>();

	for (const project of projects) {
		if (!byPath.has(project.path)) {
			byPath.set(project.path, project);
		}
	}

	return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path));
}
