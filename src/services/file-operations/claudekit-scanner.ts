import { join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import { SKIP_DIRS_CLAUDE_INTERNAL } from "@/shared/skip-directories.js";
import type { ClaudeKitSetup, ComponentCounts } from "@/types";
import { pathExists, readFile, readdir } from "fs-extra";

export interface ClaudeKitMetadata {
	version: string;
	name: string;
	description: string;
	buildDate?: string;
	repository?: {
		type: string;
		url: string;
	};
	download?: {
		lastDownloadedAt: string | null;
		downloadedBy: string | null;
		installCount: number;
	};
}

export async function scanClaudeKitDirectory(directoryPath: string): Promise<ComponentCounts> {
	const counts: ComponentCounts = {
		agents: 0,
		commands: 0,
		rules: 0,
		skills: 0,
	};

	try {
		// Check if directory exists
		if (!(await pathExists(directoryPath))) {
			return counts;
		}

		const items = await readdir(directoryPath);

		// Count agents
		if (items.includes("agents")) {
			const agentsPath = join(directoryPath, "agents");
			const agentFiles = await readdir(agentsPath);
			counts.agents = agentFiles.filter((file) => file.endsWith(".md")).length;
		}

		// Count commands
		if (items.includes("commands")) {
			const commandsPath = join(directoryPath, "commands");
			const commandFiles = await readdir(commandsPath);
			counts.commands = commandFiles.filter((file) => file.endsWith(".md")).length;
		}

		// Count rules (in .claude/rules directory)
		if (items.includes("rules")) {
			const rulesPath = join(directoryPath, "rules");
			const ruleFiles = await readdir(rulesPath);
			counts.rules = ruleFiles.filter((file) => file.endsWith(".md")).length;
		}

		// Count skills
		if (items.includes("skills")) {
			const skillsPath = join(directoryPath, "skills");
			// Count skill directories (each skill is a directory with SKILL.md)
			const skillItems = await readdir(skillsPath);
			let skillCount = 0;

			for (const item of skillItems) {
				// Skip Claude Code internal directories
				if (SKIP_DIRS_CLAUDE_INTERNAL.includes(item)) {
					continue;
				}

				const itemPath = join(skillsPath, item);
				const stat = await readdir(itemPath).catch(() => null);
				if (stat?.includes("SKILL.md")) {
					skillCount++;
				}
			}
			counts.skills = skillCount;
		}
	} catch (error) {
		// If directory doesn't exist or can't be read, return zero counts
	}

	return counts;
}

export async function readClaudeKitMetadata(
	metadataPath: string,
): Promise<ClaudeKitMetadata | null> {
	try {
		if (!(await pathExists(metadataPath))) {
			return null;
		}

		const content = await readFile(metadataPath, "utf8");
		const metadata = JSON.parse(content) as ClaudeKitMetadata;

		return metadata;
	} catch {
		return null;
	}
}

/**
 * Get the global ClaudeKit installation directory for the current platform
 * Uses PathResolver to respect CK_TEST_HOME for test isolation
 */
function getGlobalInstallDir(): string {
	return PathResolver.getGlobalKitDir();
}

export async function getClaudeKitSetup(
	projectDir: string = process.cwd(),
): Promise<ClaudeKitSetup> {
	const setup: ClaudeKitSetup = {
		global: {
			path: "",
			metadata: null,
			components: { agents: 0, commands: 0, rules: 0, skills: 0 },
		},
		project: {
			path: "",
			metadata: null,
			components: { agents: 0, commands: 0, rules: 0, skills: 0 },
		},
	};

	// Check global setup
	const globalDir = getGlobalInstallDir();

	if (await pathExists(globalDir)) {
		setup.global.path = globalDir;
		setup.global.metadata = await readClaudeKitMetadata(join(globalDir, "metadata.json"));
		setup.global.components = await scanClaudeKitDirectory(globalDir);
	}

	// Check project setup (skip if projectDir is HOME - would be same as global)
	const projectClaudeDir = join(projectDir, ".claude");
	const isLocalSameAsGlobal = projectClaudeDir === globalDir;

	if (!isLocalSameAsGlobal && (await pathExists(projectClaudeDir))) {
		setup.project.path = projectClaudeDir;
		setup.project.metadata = await readClaudeKitMetadata(join(projectClaudeDir, "metadata.json"));
		setup.project.components = await scanClaudeKitDirectory(projectClaudeDir);
	}

	return setup;
}
