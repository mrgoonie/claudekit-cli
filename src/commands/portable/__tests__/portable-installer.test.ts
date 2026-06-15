import { beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { computeContentChecksum } from "../checksum-utils.js";
import { convertItem } from "../converters/index.js";
import { providers } from "../provider-registry.js";
import type { PortableItem, ProviderPathConfig } from "../types.js";

const addPortableInstallationMock = mock(async () => undefined);
const registryDeps = {
	addPortableInstallation: addPortableInstallationMock,
};

const { installPortableItems: installPortableItemsImpl } = await import("../portable-installer.js");
const installPortableItems = (
	...args: Parameters<typeof installPortableItemsImpl>
): ReturnType<typeof installPortableItemsImpl> =>
	installPortableItemsImpl(args[0], args[1], args[2], args[3], {
		...registryDeps,
		...args[4],
	});
mock.restore();

function makePortableItem(overrides: Partial<PortableItem> = {}): PortableItem {
	return {
		name: "sample-item",
		displayName: "Sample Item",
		description: "Sample portable item",
		type: "agent",
		sourcePath: join(process.cwd(), ".tmp-portable-item.md"),
		frontmatter: {
			name: "Sample Item",
			description: "Sample portable item",
			tools: "Read,Edit,Bash",
		},
		body: "You are a sample portable item.",
		...overrides,
	};
}

function getPathConfig(
	providerName: keyof typeof providers,
	type: "agents" | "commands" | "skills" | "config" | "rules",
): ProviderPathConfig {
	const config = providers[providerName][type];
	if (!config) {
		throw new Error(`Provider ${providerName} does not support ${type}`);
	}
	return config;
}

function countMatches(content: string, pattern: RegExp): number {
	return content.match(pattern)?.length ?? 0;
}

describe("portable-installer hardening", () => {
	beforeEach(() => {
		addPortableInstallationMock.mockClear();
		addPortableInstallationMock.mockImplementation(async () => undefined);
	});

	test("rejects path traversal target in merge-single strategy", async () => {
		const pathConfig = getPathConfig("codex", "rules");
		const originalPath = pathConfig.projectPath;

		try {
			pathConfig.projectPath = "../../outside-rules.md";

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "security/rule",
						body: "# Rule\n\nDo not allow unsafe writes.",
					}),
				],
				["codex"],
				"rules",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("Unsafe path");
		} finally {
			pathConfig.projectPath = originalPath;
		}
	});

	test("rejects path traversal target in yaml-merge strategy", async () => {
		const pathConfig = getPathConfig("roo", "agents");
		const originalPath = pathConfig.projectPath;

		try {
			pathConfig.projectPath = "../../outside-roomodes.yaml";

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "roo-mode",
						frontmatter: {
							name: "Roo Mode",
							tools: "Read,Edit",
						},
					}),
				],
				["roo"],
				"agent",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("Unsafe path");
		} finally {
			pathConfig.projectPath = originalPath;
		}
	});

	test("writes Cline agent as per-file markdown (not JSON)", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-cline-"));
		const projectModesPath = join(tempDir, ".clinerules");
		const pathConfig = getPathConfig("cline", "agents");
		const originalPath = pathConfig.projectPath;

		try {
			await mkdir(projectModesPath, { recursive: true });
			pathConfig.projectPath = projectModesPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "cline-mode",
						frontmatter: {
							name: "Cline Mode",
							tools: "Read,Edit,Bash",
						},
					}),
				],
				["cline"],
				"agent",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
		} finally {
			pathConfig.projectPath = originalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("rejects unsafe nested segments", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-opencode-"));
		const commandTargetPath = join(tempDir, ".opencode", "command");
		const sourcePath = join(tempDir, "unsafe-command.md");
		const pathConfig = getPathConfig("opencode", "commands");
		const originalPath = pathConfig.projectPath;

		try {
			await mkdir(commandTargetPath, { recursive: true });
			await writeFile(sourcePath, "# Unsafe command\n", "utf-8");
			pathConfig.projectPath = commandTargetPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "../unsafe-command",
						segments: ["..", "unsafe-command"],
						sourcePath,
						frontmatter: {},
						body: "# Unsafe command\n",
					}),
				],
				["opencode"],
				"command",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("Unsafe item path segment");
		} finally {
			pathConfig.projectPath = originalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("portable-installer rollback", () => {
	beforeEach(() => {
		addPortableInstallationMock.mockClear();
		addPortableInstallationMock.mockImplementation(async () => undefined);
	});

	test("removes newly written per-file target when registry update fails", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-rollback-per-file-"));
		const commandTargetPath = join(tempDir, ".opencode", "commands");
		const sourcePath = join(tempDir, "rollback-command.md");
		const pathConfig = getPathConfig("opencode", "commands");
		const originalProjectPath = pathConfig.projectPath;

		try {
			await mkdir(commandTargetPath, { recursive: true });
			await writeFile(
				sourcePath,
				"---\nname: Rollback Command\n---\n# Rollback command\n",
				"utf-8",
			);
			pathConfig.projectPath = commandTargetPath;
			addPortableInstallationMock.mockRejectedValueOnce(new Error("registry unavailable"));

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "rollback-command",
						sourcePath,
						frontmatter: { name: "Rollback Command" },
						body: "# Rollback command\n",
					}),
				],
				["opencode"],
				"command",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("registry unavailable");
			expect(existsSync(join(commandTargetPath, "rollback-command.md"))).toBe(false);
		} finally {
			pathConfig.projectPath = originalProjectPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("restores existing merge-single file when registry update fails", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-rollback-merge-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const pathConfig = getPathConfig("opencode", "rules");
		const originalProjectPath = pathConfig.projectPath;
		const previousContent = "# Existing Rules\n\n## Rule: Keep\n\nDo not change.\n";

		try {
			await writeFile(targetFile, previousContent, "utf-8");
			pathConfig.projectPath = targetFile;
			addPortableInstallationMock.mockRejectedValueOnce(new Error("registry unavailable"));

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "new-rule",
						sourcePath: join(tempDir, "new-rule.md"),
						body: "# New Rule\n\nAdded by test.\n",
						frontmatter: {},
					}),
				],
				["opencode"],
				"rules",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("registry unavailable");
			expect(await readFile(targetFile, "utf-8")).toBe(previousContent);
		} finally {
			pathConfig.projectPath = originalProjectPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("nested command flattening", () => {
	test("installs project-scoped Codex commands as project-local skills", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-codex-project-skill-"));
		const commandTargetPath = join(tempDir, ".agents", "skills");
		const sourcePath = join(tempDir, "local.md");
		const pathConfig = getPathConfig("codex", "commands");
		const originalProjectPath = pathConfig.projectPath;
		const originalGlobalPath = pathConfig.globalPath;
		const globalCommandTargetPath = join(tempDir, "global-agents", "skills");

		try {
			await mkdir(commandTargetPath, { recursive: true });
			await writeFile(sourcePath, "---\nname: Local\n---\n# Local command\n", "utf-8");
			pathConfig.projectPath = commandTargetPath;
			pathConfig.globalPath = globalCommandTargetPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "local",
						sourcePath,
						frontmatter: { name: "Local" },
						body: "# Local command\n",
					}),
				],
				["codex"],
				"command",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(results[0].skipped).not.toBe(true);
			expect(results[0].path).toBe(join(commandTargetPath, "source-command-local", "SKILL.md"));
			expect(existsSync(join(commandTargetPath, "source-command-local", "SKILL.md"))).toBe(true);
			expect(existsSync(join(globalCommandTargetPath, "source-command-local", "SKILL.md"))).toBe(
				false,
			);
		} finally {
			pathConfig.projectPath = originalProjectPath;
			pathConfig.globalPath = originalGlobalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("converts nested Codex command to source-command skill", async () => {
		const tempDir = await mkdtemp(join(homedir(), ".tmp-portable-codex-flat-"));
		const commandTargetPath = join(tempDir, ".agents", "skills");
		const sourcePath = join(tempDir, "test-ui.md");
		const pathConfig = getPathConfig("codex", "commands");
		const originalGlobalPath = pathConfig.globalPath;

		try {
			await mkdir(commandTargetPath, { recursive: true });
			await writeFile(sourcePath, "---\nname: Test UI\n---\n# Test UI command\n", "utf-8");
			pathConfig.globalPath = commandTargetPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "test/ui",
						segments: ["test", "ui"],
						sourcePath,
						frontmatter: { name: "Test UI" },
						body: "# Test UI command\n",
					}),
				],
				["codex"],
				"command",
				{ global: true },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(existsSync(join(commandTargetPath, "source-command-test-ui", "SKILL.md"))).toBe(true);
			expect(existsSync(join(commandTargetPath, "test-ui.md"))).toBe(false);
		} finally {
			pathConfig.globalPath = originalGlobalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("converts deeply nested Codex command to source-command skill", async () => {
		const tempDir = await mkdtemp(join(homedir(), ".tmp-portable-codex-deep-"));
		const commandTargetPath = join(tempDir, ".agents", "skills");
		const sourcePath = join(tempDir, "review-codebase-parallel.md");
		const pathConfig = getPathConfig("codex", "commands");
		const originalGlobalPath = pathConfig.globalPath;

		try {
			await mkdir(commandTargetPath, { recursive: true });
			await writeFile(sourcePath, "---\nname: Review Parallel\n---\n# Review\n", "utf-8");
			pathConfig.globalPath = commandTargetPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "review/codebase/parallel",
						segments: ["review", "codebase", "parallel"],
						sourcePath,
						frontmatter: { name: "Review Parallel" },
						body: "# Review\n",
					}),
				],
				["codex"],
				"command",
				{ global: true },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(
				existsSync(join(commandTargetPath, "source-command-review-codebase-parallel", "SKILL.md")),
			).toBe(true);
		} finally {
			pathConfig.globalPath = originalGlobalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("preserves nested command for OpenCode (nestedCommands not false)", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-opencode-nest-"));
		const commandTargetPath = join(tempDir, ".opencode", "command");
		const sourcePath = join(tempDir, "test-ui.md");
		const pathConfig = getPathConfig("opencode", "commands");
		const originalProjectPath = pathConfig.projectPath;
		const originalGlobalPath = pathConfig.globalPath;

		try {
			await mkdir(commandTargetPath, { recursive: true });
			await writeFile(sourcePath, "---\nname: Test UI\n---\n# Test UI command\n", "utf-8");
			pathConfig.projectPath = commandTargetPath;
			pathConfig.globalPath = null;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "test/ui",
						segments: ["test", "ui"],
						sourcePath,
						frontmatter: { name: "Test UI" },
						body: "# Test UI command\n",
					}),
				],
				["opencode"],
				"command",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(existsSync(join(commandTargetPath, "test", "ui.md"))).toBe(true);
			expect(existsSync(join(commandTargetPath, "test-ui.md"))).toBe(false);
		} finally {
			pathConfig.projectPath = originalProjectPath;
			pathConfig.globalPath = originalGlobalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("converts flat Codex command to source-command skill", async () => {
		const tempDir = await mkdtemp(join(homedir(), ".tmp-portable-codex-noflat-"));
		const commandTargetPath = join(tempDir, ".agents", "skills");
		const sourcePath = join(tempDir, "watzup.md");
		const pathConfig = getPathConfig("codex", "commands");
		const originalGlobalPath = pathConfig.globalPath;

		try {
			await mkdir(commandTargetPath, { recursive: true });
			await writeFile(sourcePath, "---\nname: Watzup\n---\n# Watzup\n", "utf-8");
			pathConfig.globalPath = commandTargetPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "watzup",
						sourcePath,
						frontmatter: { name: "Watzup" },
						body: "# Watzup\n",
					}),
				],
				["codex"],
				"command",
				{ global: true },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(existsSync(join(commandTargetPath, "source-command-watzup", "SKILL.md"))).toBe(true);
		} finally {
			pathConfig.globalPath = originalGlobalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("rejects symlinked Codex command skill target that escapes cwd", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-codex-symlink-"));
		const outsideDir = await mkdtemp(join(tmpdir(), "portable-codex-escape-"));
		const commandTargetPath = join(tempDir, ".agents", "skills");
		const sourcePath = join(tempDir, "local.md");
		const outsidePath = join(outsideDir, "outside-skill.md");
		const skillDir = join(commandTargetPath, "source-command-local");
		const skillPath = join(skillDir, "SKILL.md");
		const pathConfig = getPathConfig("codex", "commands");
		const originalProjectPath = pathConfig.projectPath;

		try {
			await mkdir(skillDir, { recursive: true });
			await writeFile(sourcePath, "---\nname: Local\n---\n# Local command\n", "utf-8");
			await writeFile(outsidePath, "outside", "utf-8");
			await symlink(outsidePath, skillPath);
			pathConfig.projectPath = commandTargetPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "local",
						sourcePath,
						frontmatter: { name: "Local" },
						body: "# Local command\n",
					}),
				],
				["codex"],
				"command",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("symlink");
			expect(await readFile(outsidePath, "utf-8")).toBe("outside");
		} finally {
			pathConfig.projectPath = originalProjectPath;
			await rm(tempDir, { recursive: true, force: true });
			await rm(outsideDir, { recursive: true, force: true });
		}
	});

	test("rejects symlinked parent directory that escapes cwd", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-codex-parent-symlink-"));
		const outsideDir = await mkdtemp(join(tmpdir(), "portable-codex-parent-escape-"));
		const agentsLinkPath = join(tempDir, ".agents");
		const outsideAgentsPath = join(outsideDir, "outside-agents");
		const commandTargetPath = join(agentsLinkPath, "skills");
		const sourcePath = join(tempDir, "local.md");
		const pathConfig = getPathConfig("codex", "commands");
		const originalProjectPath = pathConfig.projectPath;

		try {
			await mkdir(outsideAgentsPath, { recursive: true });
			await writeFile(sourcePath, "---\nname: Local\n---\n# Local command\n", "utf-8");
			await symlink(outsideAgentsPath, agentsLinkPath, "dir");
			pathConfig.projectPath = commandTargetPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "local",
						sourcePath,
						frontmatter: { name: "Local" },
						body: "# Local command\n",
					}),
				],
				["codex"],
				"command",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("symlink");
			expect(
				existsSync(join(outsideAgentsPath, "skills", "source-command-local", "SKILL.md")),
			).toBe(false);
		} finally {
			pathConfig.projectPath = originalProjectPath;
			await rm(tempDir, { recursive: true, force: true });
			await rm(outsideDir, { recursive: true, force: true });
		}
	});

	test("accepts in-boundary symlinked parent directory (dotfile managers)", async () => {
		// Simulates stow/chezmoi/yadm setups where e.g. ~/.config is a symlink
		// to ~/dotfiles/.config — both inside the boundary. The install must
		// succeed and write to the resolved real path.
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-codex-inboundary-symlink-"));
		const realAgentsPath = join(tempDir, "dotfiles", "agents");
		const agentsLinkPath = join(tempDir, "project", ".agents");
		const commandTargetPath = join(agentsLinkPath, "skills");
		const sourcePath = join(tempDir, "local.md");
		const pathConfig = getPathConfig("codex", "commands");
		const originalProjectPath = pathConfig.projectPath;

		try {
			await mkdir(realAgentsPath, { recursive: true });
			await mkdir(join(tempDir, "project"), { recursive: true });
			await writeFile(sourcePath, "---\nname: Local\n---\n# Local command\n", "utf-8");
			await symlink(realAgentsPath, agentsLinkPath, "dir");
			pathConfig.projectPath = commandTargetPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "local",
						sourcePath,
						frontmatter: { name: "Local" },
						body: "# Local command\n",
					}),
				],
				["codex"],
				"command",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(existsSync(join(realAgentsPath, "skills", "source-command-local", "SKILL.md"))).toBe(
				true,
			);
		} finally {
			pathConfig.projectPath = originalProjectPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("rejects circular symlink (ELOOP) with a clear error", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-codex-eloop-"));
		const agentsLinkPath = join(tempDir, ".agents");
		const commandTargetPath = join(agentsLinkPath, "skills");
		const sourcePath = join(tempDir, "local.md");
		const pathConfig = getPathConfig("codex", "commands");
		const originalProjectPath = pathConfig.projectPath;

		try {
			await writeFile(sourcePath, "---\nname: Local\n---\n# Local command\n", "utf-8");
			// Circular: .agents -> .agents (self-loop via realpath chain)
			await symlink(agentsLinkPath, agentsLinkPath, "dir");
			pathConfig.projectPath = commandTargetPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "local",
						sourcePath,
						frontmatter: { name: "Local" },
						body: "# Local command\n",
					}),
				],
				["codex"],
				"command",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("circular symlink");
		} finally {
			pathConfig.projectPath = originalProjectPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("skips later Codex commands that convert to an existing batch target", async () => {
		addPortableInstallationMock.mockClear();
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-codex-collision-"));
		const commandTargetPath = join(tempDir, ".agents", "skills");
		const nestedSourcePath = join(tempDir, "foo", "bar.md");
		const flatSourcePath = join(tempDir, "foo-bar.md");
		const pathConfig = getPathConfig("codex", "commands");
		const originalProjectPath = pathConfig.projectPath;

		try {
			await mkdir(join(tempDir, "foo"), { recursive: true });
			await mkdir(commandTargetPath, { recursive: true });
			await writeFile(nestedSourcePath, "---\nname: Foo Bar\n---\n# Nested command\n", "utf-8");
			await writeFile(flatSourcePath, "---\nname: Foo Bar Flat\n---\n# Flat command\n", "utf-8");
			pathConfig.projectPath = commandTargetPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "foo/bar",
						segments: ["foo", "bar"],
						sourcePath: nestedSourcePath,
						frontmatter: { name: "Foo Bar" },
						body: "# Nested command\n",
					}),
					makePortableItem({
						type: "command",
						name: "foo-bar",
						sourcePath: flatSourcePath,
						frontmatter: { name: "Foo Bar Flat" },
						body: "# Flat command\n",
					}),
				],
				["codex"],
				"command",
				{ global: false },
			);

			const skillPath = join(commandTargetPath, "source-command-foo-bar", "SKILL.md");
			const content = await readFile(skillPath, "utf-8");
			expect(results).toHaveLength(2);
			const installed = results.find((result) => !result.skipped);
			const skipped = results.find((result) => result.skipped);
			expect(installed?.success).toBe(true);
			expect(installed?.itemName).toBe("foo/bar");
			expect(skipped?.success).toBe(true);
			expect(skipped?.itemName).toBe("foo-bar");
			expect(skipped?.warnings?.join("\n")).toContain("converted target collides");
			expect(content).toContain("# Nested command");
			expect(content).not.toContain("# Flat command");
			expect(addPortableInstallationMock).toHaveBeenCalledTimes(1);
		} finally {
			pathConfig.projectPath = originalProjectPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("Kiro migration targets", () => {
	beforeEach(() => {
		addPortableInstallationMock.mockClear();
		addPortableInstallationMock.mockImplementation(async () => undefined);
	});

	test("installs agents as Kiro custom subagents and rules/config as Kiro steering files", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-kiro-steering-"));
		const agentsDir = join(tempDir, ".kiro", "agents");
		const steeringDir = join(tempDir, ".kiro", "steering");
		const configPath = join(steeringDir, "project.md");
		const agentPathConfig = getPathConfig("kiro", "agents");
		const rulesPathConfig = getPathConfig("kiro", "rules");
		const configPathConfig = getPathConfig("kiro", "config");
		const originalAgentPath = agentPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;
		const originalConfigPath = configPathConfig.projectPath;

		try {
			agentPathConfig.projectPath = agentsDir;
			rulesPathConfig.projectPath = steeringDir;
			configPathConfig.projectPath = configPath;

			const agentResults = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "reviewer",
						frontmatter: { name: "Reviewer", tools: "Read,Edit" },
						body: "Review code changes.",
					}),
				],
				["kiro"],
				"agent",
				{ global: false },
			);

			const ruleResults = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "typescript-rules",
						frontmatter: {},
						body: "Prefer strict TypeScript.",
					}),
				],
				["kiro"],
				"rules",
				{ global: false },
			);

			const configResults = await installPortableItems(
				[
					makePortableItem({
						type: "config",
						name: "project",
						frontmatter: {},
						body: "Project context for Kiro.",
					}),
				],
				["kiro"],
				"config",
				{ global: false },
			);

			expect(agentResults[0].success).toBe(true);
			expect(ruleResults[0].success).toBe(true);
			expect(configResults[0].success).toBe(true);

			const agentContent = await readFile(join(agentsDir, "reviewer.md"), "utf-8");
			const ruleContent = await readFile(join(steeringDir, "typescript-rules.md"), "utf-8");
			const configContent = await readFile(configPath, "utf-8");

			expect(agentContent).toContain('name: "reviewer"');
			expect(agentContent).toContain('description: "Sample portable item"');
			expect(agentContent).toContain('tools: ["read","write"]');
			expect(agentContent).toContain("Review code changes.");

			expect(ruleContent).toContain("inclusion: fileMatch");
			expect(ruleContent).toContain('fileMatchPattern: "**/*.{ts,tsx}"');
			expect(ruleContent).toContain("Prefer strict TypeScript.");

			expect(configContent).toContain("inclusion: always");
			expect(configContent).toContain("# project");
			expect(configContent).toContain("Project context for Kiro.");
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			rulesPathConfig.projectPath = originalRulesPath;
			configPathConfig.projectPath = originalConfigPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("Antigravity 2.0 migration targets", () => {
	beforeEach(() => {
		addPortableInstallationMock.mockClear();
		addPortableInstallationMock.mockImplementation(async () => undefined);
	});

	test("installs agents as skills and commands/rules into .agents namespaces", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-antigravity-"));
		const skillsDir = join(tempDir, ".agents", "skills");
		const workflowsDir = join(tempDir, ".agents", "workflows");
		const rulesDir = join(tempDir, ".agents", "rules");
		const agentPathConfig = getPathConfig("antigravity", "agents");
		const commandPathConfig = getPathConfig("antigravity", "commands");
		const rulesPathConfig = getPathConfig("antigravity", "rules");
		const originalAgentPath = agentPathConfig.projectPath;
		const originalCommandPath = commandPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			agentPathConfig.projectPath = skillsDir;
			commandPathConfig.projectPath = workflowsDir;
			rulesPathConfig.projectPath = rulesDir;

			const agentResults = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "reviewer",
						frontmatter: { name: "Reviewer", description: "Review code", tools: "Read" },
						description: "Review code",
						body: "Use .claude/skills/cook/SKILL.md while reviewing.",
					}),
				],
				["antigravity"],
				"agent",
				{ global: false },
			);

			const commandResults = await installPortableItems(
				[
					makePortableItem({
						type: "command",
						name: "release",
						frontmatter: { description: "Prepare release" },
						body: "Follow .claude/rules/release.md before shipping.",
					}),
				],
				["antigravity"],
				"command",
				{ global: false },
			);

			const ruleResults = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "typescript",
						frontmatter: {},
						body: "Prefer strict TypeScript and check .claude/commands/release.md.",
					}),
				],
				["antigravity"],
				"rules",
				{ global: false },
			);

			expect(agentResults[0].success).toBe(true);
			expect(commandResults[0].success).toBe(true);
			expect(ruleResults[0].success).toBe(true);

			const agentContent = await readFile(join(skillsDir, "reviewer", "SKILL.md"), "utf-8");
			const commandContent = await readFile(join(workflowsDir, "release.md"), "utf-8");
			const ruleContent = await readFile(join(rulesDir, "typescript.md"), "utf-8");

			expect(agentContent).toContain("name: Reviewer");
			expect(agentContent).toContain("# Reviewer");
			expect(agentContent).toContain(".agents/skills/cook/SKILL.md");
			expect(commandContent).toContain(".agents/rules/release.md");
			expect(commandContent).not.toContain(".agent/");
			expect(ruleContent).toContain(".agents/workflows/release.md");
			expect(ruleContent).not.toContain(".agent/");
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			commandPathConfig.projectPath = originalCommandPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("cross-kind section preservation (issue #415)", () => {
	beforeEach(() => {
		addPortableInstallationMock.mockClear();
		addPortableInstallationMock.mockImplementation(async () => undefined);
	});

	test("preserves cross-kind sections with content integrity", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-cross-kind-integrity-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const agentPathConfig = getPathConfig("gemini-cli", "agents");
		const rulesPathConfig = getPathConfig("gemini-cli", "rules");
		const originalAgentPath = agentPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			agentPathConfig.projectPath = targetFile;
			rulesPathConfig.projectPath = targetFile;
			await writeFile(targetFile, "", "utf-8");

			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read,Edit" },
						body: "Agent body v1",
					}),
				],
				["gemini-cli"],
				"agent",
				{ global: false },
			);

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "Rule body v1",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"rules",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);

			const finalContent = await readFile(targetFile, "utf-8");
			expect(countMatches(finalContent, /^## Agent:\s*Test Agent$/gm)).toBe(1);
			expect(countMatches(finalContent, /^## Rule:\s*test-rule$/gm)).toBe(1);
			expect(finalContent).toContain("Agent body v1");
			expect(finalContent).toContain("Rule body v1");
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("preserves config when rule name is config", async () => {
		const tempDir = await mkdtemp(
			join(process.cwd(), ".tmp-portable-cross-kind-config-collision-"),
		);
		const targetFile = join(tempDir, "AGENTS.md");
		const configPathConfig = getPathConfig("gemini-cli", "config");
		const rulesPathConfig = getPathConfig("gemini-cli", "rules");
		const originalConfigPath = configPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			configPathConfig.projectPath = targetFile;
			rulesPathConfig.projectPath = targetFile;
			await writeFile(targetFile, "", "utf-8");

			await installPortableItems(
				[
					makePortableItem({
						type: "config",
						name: "project-config",
						body: "Config body v1.",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"config",
				{ global: false },
			);

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "config",
						body: "Rule named config.",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"rules",
				{ global: false },
			);

			expect(results[0].success).toBe(true);
			const finalContent = await readFile(targetFile, "utf-8");
			expect(countMatches(finalContent, /^## Config$/gm)).toBe(1);
			expect(countMatches(finalContent, /^## Rule:\s*config$/gm)).toBe(1);
			expect(finalContent).toContain("Config body v1.");
			expect(finalContent).toContain("Rule named config.");
		} finally {
			configPathConfig.projectPath = originalConfigPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("preserves same-name cross-kind sections including ':' names", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-cross-kind-colon-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const agentPathConfig = getPathConfig("gemini-cli", "agents");
		const rulesPathConfig = getPathConfig("gemini-cli", "rules");
		const originalAgentPath = agentPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			agentPathConfig.projectPath = targetFile;
			rulesPathConfig.projectPath = targetFile;
			await writeFile(targetFile, "", "utf-8");

			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "team-alpha",
						frontmatter: { name: "team:alpha", tools: "Read" },
						body: "Agent colon body.",
					}),
				],
				["gemini-cli"],
				"agent",
				{ global: false },
			);

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "team:alpha",
						body: "Rule colon body.",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"rules",
				{ global: false },
			);

			expect(results[0].success).toBe(true);
			const finalContent = await readFile(targetFile, "utf-8");
			expect(countMatches(finalContent, /^## Agent:\s*team:alpha$/gm)).toBe(1);
			expect(countMatches(finalContent, /^## Rule:\s*team:alpha$/gm)).toBe(1);
			expect(finalContent).toContain("Agent colon body.");
			expect(finalContent).toContain("Rule colon body.");
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("preserves custom preamble and unknown managed blocks", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-preamble-unknown-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const rulesPathConfig = getPathConfig("goose", "rules");
		const originalRulesPath = rulesPathConfig.projectPath;
		const customPreamble = "# Custom Instructions\n\nKeep this preamble.";
		const unknownSection = "## Custom Section\n\nKeep this unknown block.";

		try {
			await writeFile(
				targetFile,
				`${customPreamble}\n\n---\n\n## Config\n\nOriginal config.\n\n---\n\n${unknownSection}\n`,
				"utf-8",
			);
			rulesPathConfig.projectPath = targetFile;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "This is a test rule.",
						frontmatter: {},
					}),
				],
				["goose"],
				"rules",
				{ global: false },
			);

			expect(results[0].success).toBe(true);
			const finalContent = await readFile(targetFile, "utf-8");
			expect(finalContent).toContain("Keep this preamble.");
			expect(finalContent).toContain("## Config");
			expect(finalContent).toContain("Original config.");
			expect(finalContent).toContain(unknownSection);
			expect(finalContent).toContain("## Rule: test-rule");
		} finally {
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("handles heading and separator format variants", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-heading-separator-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const rulesPathConfig = getPathConfig("gemini-cli", "rules");
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			rulesPathConfig.projectPath = targetFile;
			await writeFile(
				targetFile,
				"## rule: keep-lower\r\n\r\nLower rule body.\r\n  ---  \r\n\r\n## config\r\n\r\nLower config body.\r\n",
				"utf-8",
			);

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "new-rule",
						body: "New rule body.",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"rules",
				{ global: false },
			);

			expect(results[0].success).toBe(true);
			const finalContent = await readFile(targetFile, "utf-8");
			expect(finalContent).toContain("## rule: keep-lower");
			expect(finalContent).toContain("Lower config body.");
			expect(finalContent).toContain("## Rule: new-rule");
			expect(finalContent).toContain("New rule body.");
		} finally {
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("preserves all three kinds when re-migrating without duplicate headings", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-cross-kind-all-three-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const agentPathConfig = getPathConfig("gemini-cli", "agents");
		const configPathConfig = getPathConfig("gemini-cli", "config");
		const rulesPathConfig = getPathConfig("gemini-cli", "rules");
		const originalAgentPath = agentPathConfig.projectPath;
		const originalConfigPath = configPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			await writeFile(targetFile, "", "utf-8");
			agentPathConfig.projectPath = targetFile;
			configPathConfig.projectPath = targetFile;
			rulesPathConfig.projectPath = targetFile;

			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read" },
						body: "Agent v1",
					}),
				],
				["gemini-cli"],
				"agent",
				{ global: false },
			);

			await installPortableItems(
				[
					makePortableItem({
						type: "config",
						name: "project-config",
						body: "Config v1",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"config",
				{ global: false },
			);

			await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "Rule v1",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"rules",
				{ global: false },
			);

			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read" },
						body: "Agent v2",
					}),
				],
				["gemini-cli"],
				"agent",
				{ global: false },
			);

			await installPortableItems(
				[
					makePortableItem({
						type: "config",
						name: "project-config",
						body: "Config v2",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"config",
				{ global: false },
			);

			await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "Rule v2",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"rules",
				{ global: false },
			);

			const finalContent = await readFile(targetFile, "utf-8");
			expect(countMatches(finalContent, /^## Agent:\s*Test Agent$/gm)).toBe(1);
			expect(countMatches(finalContent, /^## Config$/gm)).toBe(1);
			expect(countMatches(finalContent, /^## Rule:\s*test-rule$/gm)).toBe(1);
			expect(finalContent).toContain("Agent v2");
			expect(finalContent).toContain("Config v2");
			expect(finalContent).toContain("Rule v2");
			expect(finalContent).not.toContain("Agent v1");
			expect(finalContent).not.toContain("Config v1");
			expect(finalContent).not.toContain("Rule v1");
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			configPathConfig.projectPath = originalConfigPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("order independence across native merge-single writes", async () => {
		const tempDir1 = await mkdtemp(join(process.cwd(), ".tmp-portable-order1-"));
		const tempDir2 = await mkdtemp(join(process.cwd(), ".tmp-portable-order2-"));
		const targetFile1 = join(tempDir1, "AGENTS.md");
		const targetFile2 = join(tempDir2, "AGENTS.md");
		const agentPathConfig = getPathConfig("gemini-cli", "agents");
		const rulesPathConfig = getPathConfig("gemini-cli", "rules");
		const originalAgentPath = agentPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			await writeFile(targetFile1, "", "utf-8");
			await writeFile(targetFile2, "", "utf-8");

			agentPathConfig.projectPath = targetFile1;
			rulesPathConfig.projectPath = targetFile1;
			await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "Rule scenario one",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"rules",
				{ global: false },
			);
			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read" },
						body: "Agent scenario one",
					}),
				],
				["gemini-cli"],
				"agent",
				{ global: false },
			);

			agentPathConfig.projectPath = targetFile2;
			rulesPathConfig.projectPath = targetFile2;
			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read" },
						body: "Agent scenario two",
					}),
				],
				["gemini-cli"],
				"agent",
				{ global: false },
			);
			await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "Rule scenario two",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"rules",
				{ global: false },
			);

			const content1 = await readFile(targetFile1, "utf-8");
			const content2 = await readFile(targetFile2, "utf-8");

			expect(countMatches(content1, /^## Agent:\s*Test Agent$/gm)).toBe(1);
			expect(countMatches(content1, /^## Rule:\s*test-rule$/gm)).toBe(1);
			expect(countMatches(content2, /^## Agent:\s*Test Agent$/gm)).toBe(1);
			expect(countMatches(content2, /^## Rule:\s*test-rule$/gm)).toBe(1);
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir1, { recursive: true, force: true });
			await rm(tempDir2, { recursive: true, force: true });
		}
	});

	test("rejects multiple config items in one merge-single batch", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-config-batch-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const configPathConfig = getPathConfig("codex", "config");
		const originalConfigPath = configPathConfig.projectPath;

		try {
			configPathConfig.projectPath = targetFile;
			const results = await installPortableItems(
				[
					makePortableItem({
						type: "config",
						name: "cfg-a",
						body: "Config A",
						frontmatter: {},
					}),
					makePortableItem({
						type: "config",
						name: "cfg-b",
						body: "Config B",
						frontmatter: {},
					}),
				],
				["codex"],
				"config",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("only one item");
		} finally {
			configPathConfig.projectPath = originalConfigPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("records config ownedSections and converted source checksum", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-config-owned-sections-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const configPathConfig = getPathConfig("codex", "config");
		const originalConfigPath = configPathConfig.projectPath;

		try {
			configPathConfig.projectPath = targetFile;
			addPortableInstallationMock.mockClear();

			const item = makePortableItem({
				type: "config",
				name: "project-config",
				body: "Config body for checksum.",
				frontmatter: {},
			});
			const results = await installPortableItems([item], ["codex"], "config", { global: false });

			expect(results[0].success).toBe(true);
			expect(addPortableInstallationMock).toHaveBeenCalledTimes(1);
			const firstCall = addPortableInstallationMock.mock.calls[0] as unknown as unknown[];
			const metadata = (firstCall[6] ?? {}) as {
				sourceChecksum?: string;
				ownedSections?: string[];
			};
			expect(metadata.ownedSections).toEqual(["config"]);

			const converted = convertItem(item, configPathConfig.format, "codex");
			expect(metadata.sourceChecksum).toBe(computeContentChecksum(converted.content));
		} finally {
			configPathConfig.projectPath = originalConfigPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("serializes concurrent merge-single writes for the same target", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-concurrency-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const rulesPathConfig = getPathConfig("codex", "rules");
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			rulesPathConfig.projectPath = targetFile;
			await writeFile(targetFile, "", "utf-8");

			const installs = Array.from({ length: 8 }, (_, index) =>
				installPortableItems(
					[
						makePortableItem({
							type: "rules",
							name: `parallel-rule-${index + 1}`,
							body: `Parallel body ${index + 1}`,
							frontmatter: {},
						}),
					],
					["codex"],
					"rules",
					{ global: false },
				),
			);

			const results = (await Promise.all(installs)).flat();
			expect(results.every((result) => result.success)).toBe(true);

			const finalContent = await readFile(targetFile, "utf-8");
			for (let index = 1; index <= 8; index += 1) {
				expect(finalContent).toContain(`## Rule: parallel-rule-${index}`);
				expect(finalContent).toContain(`Parallel body ${index}`);
			}
		} finally {
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("keeps existing merge-single file unchanged on conversion error", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-conversion-error-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const agentPathConfig = getPathConfig("gemini-cli", "agents");
		const originalAgentPath = agentPathConfig.projectPath;
		const previousContent = "## Rule: keep\n\nDo not change.\n";

		try {
			await writeFile(targetFile, previousContent, "utf-8");
			agentPathConfig.projectPath = targetFile;

			const explodingFrontmatter: Record<string, unknown> = {};
			Object.defineProperty(explodingFrontmatter, "name", {
				get: () => {
					throw new Error("frontmatter exploded");
				},
			});

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "exploding-agent",
						frontmatter: explodingFrontmatter,
						body: "Broken conversion body",
					}),
				],
				["gemini-cli"],
				"agent",
				{ global: false },
			);

			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("frontmatter exploded");
			expect(await readFile(targetFile, "utf-8")).toBe(previousContent);
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("ignores --- inside fenced code blocks when parsing sections", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-code-fence-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const rulesPathConfig = getPathConfig("codex", "rules");
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			rulesPathConfig.projectPath = targetFile;
			const existingContent = [
				"## Rule: example",
				"",
				"```bash",
				"---",
				"This separator is inside a code fence",
				"---",
				"```",
				"",
				"Rule body here.",
			].join("\n");
			await writeFile(targetFile, existingContent, "utf-8");

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "new-rule",
						body: "New rule body.",
						frontmatter: {},
					}),
				],
				["codex"],
				"rules",
				{ global: false },
			);

			expect(results[0].success).toBe(true);
			const finalContent = await readFile(targetFile, "utf-8");
			// The existing rule should remain intact (not split by fence-internal separator)
			expect(countMatches(finalContent, /^## Rule:\s*example$/gm)).toBe(1);
			expect(countMatches(finalContent, /^## Rule:\s*new-rule$/gm)).toBe(1);
			expect(finalContent).toContain("Rule body here.");
			expect(finalContent).toContain("New rule body.");
		} finally {
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("ignores managed headings inside fenced code blocks", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-heading-in-fence-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const rulesPathConfig = getPathConfig("codex", "rules");
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			rulesPathConfig.projectPath = targetFile;
			const preambleWithCodeFence = [
				"# Documentation",
				"",
				"Example format:",
				"```markdown",
				"## Agent: Example",
				"This is not a real section",
				"```",
			].join("\n");
			const existingContent = `${preambleWithCodeFence}\n\n---\n\n## Rule: actual\n\nActual rule body.\n`;
			await writeFile(targetFile, existingContent, "utf-8");

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "new-rule",
						body: "New rule body.",
						frontmatter: {},
					}),
				],
				["codex"],
				"rules",
				{ global: false },
			);

			expect(results[0].success).toBe(true);
			const finalContent = await readFile(targetFile, "utf-8");
			// Preamble with code fence should remain
			expect(finalContent).toContain("## Agent: Example");
			expect(finalContent).toContain("This is not a real section");
			// Actual managed sections
			expect(countMatches(finalContent, /^## Rule:\s*actual$/gm)).toBe(1);
			expect(countMatches(finalContent, /^## Rule:\s*new-rule$/gm)).toBe(1);
		} finally {
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("warns on duplicate sections in existing file", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-duplicate-warning-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const rulesPathConfig = getPathConfig("codex", "rules");
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			rulesPathConfig.projectPath = targetFile;
			const existingContent = [
				"## Rule: duplicate",
				"First occurrence.",
				"---",
				"## Rule: duplicate",
				"Second occurrence (should be kept).",
			].join("\n\n");
			await writeFile(targetFile, existingContent, "utf-8");

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "new-rule",
						body: "New rule body.",
						frontmatter: {},
					}),
				],
				["codex"],
				"rules",
				{ global: false },
			);

			expect(results[0].success).toBe(true);
			expect(results[0].warnings).toBeDefined();
			expect(results[0].warnings?.some((w) => w.includes("Duplicate"))).toBe(true);
			const finalContent = await readFile(targetFile, "utf-8");
			// Only one duplicate section should remain (last occurrence)
			expect(countMatches(finalContent, /^## Rule:\s*duplicate$/gm)).toBe(1);
			expect(finalContent).toContain("Second occurrence (should be kept).");
			expect(finalContent).not.toContain("First occurrence.");
		} finally {
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("sequential installs use section-level checksums", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-sequential-checksums-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const agentPathConfig = getPathConfig("gemini-cli", "agents");
		const configPathConfig = getPathConfig("gemini-cli", "config");
		const rulesPathConfig = getPathConfig("gemini-cli", "rules");
		const originalAgentPath = agentPathConfig.projectPath;
		const originalConfigPath = configPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			agentPathConfig.projectPath = targetFile;
			configPathConfig.projectPath = targetFile;
			rulesPathConfig.projectPath = targetFile;
			await writeFile(targetFile, "", "utf-8");

			// Install agent
			const agentResult = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read" },
						body: "Agent body.",
					}),
				],
				["gemini-cli"],
				"agent",
				{ global: false },
			);
			expect(agentResult[0].success).toBe(true);

			// Install config (should not cause false conflict due to file hash mismatch)
			const configResult = await installPortableItems(
				[
					makePortableItem({
						type: "config",
						name: "project-config",
						body: "Config body.",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"config",
				{ global: false },
			);
			expect(configResult[0].success).toBe(true);

			// Install rules (should not cause false conflict)
			const rulesResult = await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "Rule body.",
						frontmatter: {},
					}),
				],
				["gemini-cli"],
				"rules",
				{ global: false },
			);
			expect(rulesResult[0].success).toBe(true);

			// Re-install agent (should succeed without false conflict)
			const agentReinstall = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read" },
						body: "Agent body updated.",
					}),
				],
				["gemini-cli"],
				"agent",
				{ global: false },
			);
			expect(agentReinstall[0].success).toBe(true);

			const finalContent = await readFile(targetFile, "utf-8");
			expect(finalContent).toContain("Agent body updated.");
			expect(finalContent).toContain("Config body.");
			expect(finalContent).toContain("Rule body.");
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			configPathConfig.projectPath = originalConfigPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("codex-toml agent installer", () => {
	beforeEach(() => {
		addPortableInstallationMock.mockClear();
		addPortableInstallationMock.mockImplementation(async () => undefined);
	});

	test("installs codex agent TOML file and managed config.toml entry", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-codex-toml-install-"));
		const agentsPath = join(tempDir, ".codex", "agents");
		const configPath = join(tempDir, ".codex", "config.toml");
		const pathConfig = getPathConfig("codex", "agents");
		const originalPath = pathConfig.projectPath;

		try {
			pathConfig.projectPath = agentsPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "code-reviewer",
						frontmatter: {
							name: "Code Reviewer",
							description: "Review code",
							model: "gpt-5",
							tools: "Read,Edit,Bash",
						},
						body: "Review pull requests thoroughly.",
					}),
				],
				["codex"],
				"agent",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(existsSync(join(agentsPath, "code_reviewer.toml"))).toBe(true);
			expect(existsSync(configPath)).toBe(true);

			const config = await readFile(configPath, "utf-8");
			expect(config).toContain("# --- ck-managed-agents-start ---");
			expect(config).toContain("[agents.code_reviewer]");
			expect(config).toContain('config_file = "agents/code_reviewer.toml"');
			expect(addPortableInstallationMock).toHaveBeenCalledTimes(1);
			const registryCall = addPortableInstallationMock.mock.calls[0] as unknown as unknown[];
			const metadata = registryCall[6] as {
				sourceChecksum?: string;
				targetChecksum?: string;
			};
			const converted = convertItem(
				makePortableItem({
					type: "agent",
					name: "code-reviewer",
					frontmatter: {
						name: "Code Reviewer",
						description: "Review code",
						model: "gpt-5",
						tools: "Read,Edit,Bash",
					},
					body: "Review pull requests thoroughly.",
				}),
				"fm-to-codex-toml",
				"codex",
			);
			expect(metadata.sourceChecksum).toBe(computeContentChecksum(converted.content));
			expect(metadata.targetChecksum).toBe(computeContentChecksum(converted.content));
		} finally {
			pathConfig.projectPath = originalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("skips colliding slugs in same batch and keeps deterministic output", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-codex-toml-collision-"));
		const agentsPath = join(tempDir, ".codex", "agents");
		const configPath = join(tempDir, ".codex", "config.toml");
		const pathConfig = getPathConfig("codex", "agents");
		const originalPath = pathConfig.projectPath;

		try {
			pathConfig.projectPath = agentsPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "My Agent",
						body: "First body",
						frontmatter: { name: "My Agent", tools: "Read,Edit" },
					}),
					makePortableItem({
						type: "agent",
						name: "my-agent",
						body: "Second body",
						frontmatter: { name: "my-agent", tools: "Read,Edit" },
					}),
				],
				["codex"],
				"agent",
				{ global: false },
			);

			expect(results[0].success).toBe(true);
			expect(results[0].warnings?.some((w) => w.includes("slug collision"))).toBe(true);
			expect(existsSync(join(agentsPath, "my_agent.toml"))).toBe(true);
			const agentToml = await readFile(join(agentsPath, "my_agent.toml"), "utf-8");
			expect(agentToml).toContain("First body");
			expect(agentToml).not.toContain("Second body");

			const config = await readFile(configPath, "utf-8");
			expect(countMatches(config, /^\[agents\.my_agent\]$/gm)).toBe(1);
		} finally {
			pathConfig.projectPath = originalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("fails safely when config.toml has malformed managed sentinels", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-codex-toml-malformed-"));
		const codexDir = join(tempDir, ".codex");
		const agentsPath = join(codexDir, "agents");
		const configPath = join(codexDir, "config.toml");
		const pathConfig = getPathConfig("codex", "agents");
		const originalPath = pathConfig.projectPath;

		try {
			await mkdir(codexDir, { recursive: true });
			await writeFile(
				configPath,
				'# --- ck-managed-agents-start ---\n[agents.old]\ndescription = "Old"\nconfig_file = "agents/old.toml"\n',
				"utf-8",
			);
			pathConfig.projectPath = agentsPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "new-agent",
						body: "Body",
						frontmatter: { name: "New Agent", tools: "Read,Edit" },
					}),
				],
				["codex"],
				"agent",
				{ global: false },
			);

			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("Malformed CK managed agent sentinels");
			expect(existsSync(join(agentsPath, "new_agent.toml"))).toBe(false);
		} finally {
			pathConfig.projectPath = originalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("repairs broken installed config when legacy agent table is inline", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-codex-toml-inline-repair-"));
		const agentsPath = join(tempDir, ".codex", "agents");
		const configPath = join(tempDir, ".codex", "config.toml");
		const pathConfig = getPathConfig("codex", "agents");
		const originalPath = pathConfig.projectPath;

		try {
			await mkdir(agentsPath, { recursive: true });
			await writeFile(join(agentsPath, "code_simplifier.toml"), "# already installed", "utf-8");
			await writeFile(
				configPath,
				[
					'model = "gpt-5.3-codex"',
					'trust_level = "trusted"[agents.code_simplifier]',
					'description = "Simplify code"',
					'config_file = "agents/code_simplifier.toml"',
				].join("\n"),
				"utf-8",
			);
			pathConfig.projectPath = agentsPath;

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "code-simplifier",
						body: "Already installed.",
						frontmatter: { name: "Code Simplifier", tools: "Read,Edit" },
					}),
				],
				["codex"],
				"agent",
				{ global: false },
			);

			expect(results[0].success).toBe(true);
			expect(results[0].warnings?.some((warning) => warning.includes("inline [agents.*]"))).toBe(
				true,
			);

			const config = await readFile(configPath, "utf-8");
			expect(config).toContain('trust_level = "trusted"\n[agents.code_simplifier]');
			expect(config).not.toContain('"trusted"[agents');
			expect(addPortableInstallationMock).not.toHaveBeenCalled();
		} finally {
			pathConfig.projectPath = originalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("rolls back written files when registry update fails", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-codex-toml-rollback-"));
		const agentsPath = join(tempDir, ".codex", "agents");
		const configPath = join(tempDir, ".codex", "config.toml");
		const pathConfig = getPathConfig("codex", "agents");
		const originalPath = pathConfig.projectPath;

		try {
			pathConfig.projectPath = agentsPath;
			addPortableInstallationMock.mockRejectedValueOnce(new Error("registry unavailable"));

			const results = await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "rollback-agent",
						body: "Rollback me",
						frontmatter: { name: "Rollback Agent", tools: "Read,Edit" },
					}),
				],
				["codex"],
				"agent",
				{ global: false },
			);

			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("registry unavailable");
			expect(existsSync(join(agentsPath, "rollback_agent.toml"))).toBe(false);
			expect(existsSync(configPath)).toBe(false);
		} finally {
			pathConfig.projectPath = originalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("serializes concurrent codex agent installs for the same config target", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-codex-toml-concurrency-"));
		const agentsPath = join(tempDir, ".codex", "agents");
		const configPath = join(tempDir, ".codex", "config.toml");
		const pathConfig = getPathConfig("codex", "agents");
		const originalPath = pathConfig.projectPath;

		try {
			pathConfig.projectPath = agentsPath;
			await mkdir(agentsPath, { recursive: true });

			const installs = Array.from({ length: 6 }, (_, index) =>
				installPortableItems(
					[
						makePortableItem({
							type: "agent",
							name: `concurrent-agent-${index + 1}`,
							body: `Body ${index + 1}`,
							frontmatter: {
								name: `Concurrent Agent ${index + 1}`,
								tools: "Read,Edit",
							},
						}),
					],
					["codex"],
					"agent",
					{ global: false },
				),
			);

			const results = (await Promise.all(installs)).flat();
			expect(results.every((result) => result.success)).toBe(true);
			expect(existsSync(configPath)).toBe(true);

			const config = await readFile(configPath, "utf-8");
			for (let index = 1; index <= 6; index += 1) {
				expect(config).toContain(`[agents.concurrent_agent_${index}]`);
				expect(existsSync(join(agentsPath, `concurrent_agent_${index}.toml`))).toBe(true);
			}
		} finally {
			pathConfig.projectPath = originalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
