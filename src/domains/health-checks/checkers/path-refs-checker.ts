import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { CheckResult } from "../types.js";

/**
 * Check if path references in CLAUDE.md are valid
 */
export async function checkPathRefsValid(projectDir: string): Promise<CheckResult> {
	const globalClaudeMd = join(PathResolver.getGlobalKitDir(), "CLAUDE.md");
	const projectClaudeMd = join(projectDir, ".claude", "CLAUDE.md");

	const claudeMdPath = existsSync(globalClaudeMd)
		? globalClaudeMd
		: existsSync(projectClaudeMd)
			? projectClaudeMd
			: null;

	if (!claudeMdPath) {
		return {
			id: "ck-path-refs-valid",
			name: "Path References",
			group: "claudekit",
			priority: "extended",
			status: "info",
			message: "No CLAUDE.md found",
			autoFixable: false,
		};
	}

	try {
		const content = await readFile(claudeMdPath, "utf-8");

		// Find @path references (e.g., @.claude/workflows/foo.md)
		const refPattern = /@([^\s\)]+)/g;
		const refs = [...content.matchAll(refPattern)].map((m) => m[1]);

		if (refs.length === 0) {
			return {
				id: "ck-path-refs-valid",
				name: "Path References",
				group: "claudekit",
				priority: "extended",
				status: "info",
				message: "No @path references found",
				autoFixable: false,
			};
		}

		// Check each reference
		const baseDir = dirname(claudeMdPath);
		const home = homedir();
		const broken: string[] = [];

		for (const ref of refs) {
			// Resolve relative to CLAUDE.md location
			let refPath: string;
			if (ref.startsWith("$HOME") || ref.startsWith("%USERPROFILE%")) {
				// Handle home directory variables - normalize to prevent traversal
				refPath = normalize(ref.replace("$HOME", home).replace("%USERPROFILE%", home));
			} else if (ref.startsWith("/")) {
				// Absolute paths (Unix)
				refPath = normalize(ref);
			} else if (ref.includes(":") && ref.startsWith("\\")) {
				// Absolute paths (Windows)
				refPath = normalize(ref);
			} else {
				// Relative paths - resolve relative to CLAUDE.md directory
				refPath = resolve(baseDir, ref);
			}

			// Validate resolved path stays within expected boundaries
			// For home-relative paths, must stay within home directory
			// For relative paths, must stay within baseDir or be a valid resolved path
			const normalizedPath = normalize(refPath);
			const isWithinHome = normalizedPath.startsWith(home);
			const isWithinBase = normalizedPath.startsWith(normalize(baseDir));
			const isAbsoluteAllowed = ref.startsWith("/") || (ref.includes(":") && ref.startsWith("\\"));

			// Skip paths that escape expected boundaries (potential path traversal)
			if (!isWithinHome && !isWithinBase && !isAbsoluteAllowed) {
				logger.verbose("Skipping potentially unsafe path reference", { ref, refPath });
				continue;
			}

			if (!existsSync(normalizedPath)) {
				broken.push(ref);
			}
		}

		if (broken.length > 0) {
			return {
				id: "ck-path-refs-valid",
				name: "Path References",
				group: "claudekit",
				priority: "extended",
				status: "warn",
				message: `${broken.length}/${refs.length} broken`,
				details: broken.slice(0, 3).join(", "),
				suggestion: "Some @path references point to missing files",
				autoFixable: false,
			};
		}

		return {
			id: "ck-path-refs-valid",
			name: "Path References",
			group: "claudekit",
			priority: "extended",
			status: "pass",
			message: `${refs.length} valid`,
			autoFixable: false,
		};
	} catch (error) {
		return {
			id: "ck-path-refs-valid",
			name: "Path References",
			group: "claudekit",
			priority: "extended",
			status: "info",
			message: "Could not parse CLAUDE.md",
			autoFixable: false,
		};
	}
}
