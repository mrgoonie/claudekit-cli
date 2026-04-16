import { dirname, join } from "pathe";
import type { ProjectInfo } from "../../lib/tauri-commands";

export function buildDesktopScanRoots(globalConfigDir: string): string[] {
	const homeDir = dirname(globalConfigDir);

	return [homeDir, join(homeDir, "projects"), join(homeDir, "code"), join(homeDir, "dev")];
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
