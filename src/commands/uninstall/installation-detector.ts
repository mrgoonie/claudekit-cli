/**
 * Installation Detector
 *
 * Detects ClaudeKit installations (local and global).
 */

import { getClaudeKitSetup } from "@/services/file-operations/claudekit-scanner.js";
import { pathExists } from "fs-extra";

export interface Installation {
	type: "local" | "global";
	path: string;
	exists: boolean;
}

/**
 * Detect both local and global ClaudeKit installations
 */
export async function detectInstallations(): Promise<Installation[]> {
	const installations: Installation[] = [];

	// Detect both local and global installations
	const setup = await getClaudeKitSetup(process.cwd());

	// Add local installation if found (must have metadata to be valid ClaudeKit installation)
	if (setup.project.path && setup.project.metadata) {
		installations.push({
			type: "local",
			path: setup.project.path,
			exists: await pathExists(setup.project.path),
		});
	}

	// Add global installation if found (must have metadata to be valid ClaudeKit installation)
	if (setup.global.path && setup.global.metadata) {
		installations.push({
			type: "global",
			path: setup.global.path,
			exists: await pathExists(setup.global.path),
		});
	}

	return installations.filter((i) => i.exists);
}
