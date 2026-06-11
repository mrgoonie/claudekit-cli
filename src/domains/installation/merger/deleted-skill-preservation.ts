import { dirname, join, relative } from "node:path";
import { getKitMetadata } from "@/domains/migration/metadata-migration.js";
import { readManifest } from "@/services/file-operations/manifest/manifest-reader.js";
import type { KitType } from "@/types";
import { pathExists } from "fs-extra";

interface IgnoredSkillOptions {
	files: string[];
	sourceDir: string;
	destDir: string;
	claudeDir: string;
	installingKit: KitType;
}

export async function findIgnoredSkillDirectories({
	files,
	sourceDir,
	destDir,
	claudeDir,
	installingKit,
}: IgnoredSkillOptions): Promise<Set<string>> {
	const sourceSkillRoots = findSourceSkillRoots(files, sourceDir);
	const ignoredSkillDirectories = new Set<string>();

	if (sourceSkillRoots.size === 0) return ignoredSkillDirectories;

	const metadata = await readManifest(claudeDir);
	const kitMetadata = metadata ? getKitMetadata(metadata, installingKit) : null;
	if (!kitMetadata) return ignoredSkillDirectories;

	const previouslyTrackedRoots = new Set<string>();
	for (const file of kitMetadata.files ?? []) {
		const skillRoot = findSkillRoot(file.path, sourceSkillRoots.keys());
		if (skillRoot) previouslyTrackedRoots.add(skillRoot);
	}

	const existingIgnoredRoots = new Set(
		(kitMetadata.ignoredSkills ?? []).flatMap((path) => {
			const root = normalizeSkillRoot(path);
			return root ? [root] : [];
		}),
	);

	for (const [metadataRoot, sourceRoot] of sourceSkillRoots) {
		const destSkillRoot = join(destDir, ...sourceRoot.split("/"));
		const skillExists = await pathExists(destSkillRoot);
		if (
			existingIgnoredRoots.has(metadataRoot) ||
			(!skillExists && previouslyTrackedRoots.has(metadataRoot))
		) {
			ignoredSkillDirectories.add(metadataRoot);
		}
	}

	return ignoredSkillDirectories;
}

export function shouldSkipIgnoredSkill(
	normalizedRelativePath: string,
	ignoredSkillDirectories: Iterable<string>,
): boolean {
	const metadataPath = toMetadataPath(normalizedRelativePath);
	if (!metadataPath) return false;
	return findSkillRoot(metadataPath, ignoredSkillDirectories) !== null;
}

function findSourceSkillRoots(files: string[], sourceDir: string): Map<string, string> {
	const sourceSkillRoots = new Map<string, string>();

	for (const file of files) {
		const normalizedPath = relative(sourceDir, file).replace(/\\/g, "/");
		const metadataPath = toMetadataPath(normalizedPath);
		if (!metadataPath?.endsWith("/SKILL.md")) continue;

		const metadataRoot = dirname(metadataPath).replace(/\\/g, "/");
		const sourceRoot = dirname(normalizedPath).replace(/\\/g, "/");
		sourceSkillRoots.set(metadataRoot, sourceRoot);
	}

	return sourceSkillRoots;
}

function toMetadataPath(normalizedRelativePath: string): string | null {
	const path = normalizedRelativePath.replace(/^\.claude\//, "");
	return path.startsWith("skills/") ? path : null;
}

function normalizeSkillRoot(path: string): string | null {
	const normalized = path
		.replace(/\\/g, "/")
		.replace(/^\.claude\//, "")
		.replace(/\/+$/, "");
	return normalized.startsWith("skills/") && normalized.split("/").length >= 2 ? normalized : null;
}

function findSkillRoot(path: string, skillRoots: Iterable<string>): string | null {
	const normalizedPath = path.replace(/\\/g, "/").replace(/^\.claude\//, "");
	for (const root of skillRoots) {
		if (normalizedPath === `${root}/SKILL.md` || normalizedPath.startsWith(`${root}/`)) {
			return root;
		}
	}
	return null;
}
