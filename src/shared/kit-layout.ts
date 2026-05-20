import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	ClaudeKitPackageMetadataSchema,
	DEFAULT_KIT_LAYOUT,
	type KitLayout,
	KitLayoutSchema,
} from "@/types";

function uniquePaths(paths: string[]): string[] {
	return [...new Set(paths)];
}

export function findFirstExistingPath(paths: string[]): string | null {
	for (const candidate of paths) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

export function resolveKitLayout(projectRoot: string): KitLayout {
	const packageJsonPath = join(projectRoot, "package.json");
	if (!existsSync(packageJsonPath)) {
		return DEFAULT_KIT_LAYOUT;
	}

	try {
		const parsed = ClaudeKitPackageMetadataSchema.parse(
			JSON.parse(readFileSync(packageJsonPath, "utf8")),
		);
		return KitLayoutSchema.parse({
			...DEFAULT_KIT_LAYOUT,
			...(parsed.claudekit ?? {}),
		});
	} catch {
		return DEFAULT_KIT_LAYOUT;
	}
}

export function getProjectLayoutCandidates(projectRoot: string, subPath: string): string[] {
	const layout = resolveKitLayout(projectRoot);
	return uniquePaths([
		join(projectRoot, layout.sourceDir, subPath),
		join(projectRoot, DEFAULT_KIT_LAYOUT.sourceDir, subPath),
	]);
}

export function findExistingProjectLayoutPath(projectRoot: string, subPath: string): string | null {
	return findFirstExistingPath(getProjectLayoutCandidates(projectRoot, subPath));
}

export function getProjectConfigCandidates(projectRoot: string): string[] {
	const layout = resolveKitLayout(projectRoot);
	return uniquePaths([
		join(projectRoot, "CLAUDE.md"),
		join(projectRoot, layout.sourceDir, "CLAUDE.md"),
		join(projectRoot, DEFAULT_KIT_LAYOUT.sourceDir, "CLAUDE.md"),
	]);
}

export function findExistingProjectConfigPath(projectRoot: string): string | null {
	return findFirstExistingPath(getProjectConfigCandidates(projectRoot));
}
