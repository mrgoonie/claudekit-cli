import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { providers } from "../provider-registry.js";
import type { PortableItem, ProviderPathConfig } from "../types.js";

const addPortableInstallationMock = mock(async () => undefined);
const actualPortableRegistry = await import("../portable-registry.js");

mock.module("../portable-registry.js", () => ({
	...actualPortableRegistry,
	addPortableInstallation: addPortableInstallationMock,
}));

const { installPortableItems } = await import("../portable-installer.js");

afterAll(() => {
	mock.restore();
});

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

	test("fails safely when existing Cline modes JSON is corrupted", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-cline-"));
		const projectModesPath = join(tempDir, ".clinerules");
		const modesJsonPath = join(projectModesPath, "cline_custom_modes.json");
		const pathConfig = getPathConfig("cline", "agents");
		const originalPath = pathConfig.projectPath;

		try {
			await mkdir(projectModesPath, { recursive: true });
			await writeFile(modesJsonPath, "{ invalid json", "utf-8");
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
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain("Failed to parse existing Cline modes JSON");
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
	test("flattens nested command for Codex (nestedCommands: false)", async () => {
		const tempDir = await mkdtemp(join(homedir(), ".tmp-portable-codex-flat-"));
		const commandTargetPath = join(tempDir, ".codex", "prompts");
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
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(existsSync(join(commandTargetPath, "test-ui.md"))).toBe(true);
			expect(existsSync(join(commandTargetPath, "test", "ui.md"))).toBe(false);
		} finally {
			pathConfig.globalPath = originalGlobalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("flattens deeply nested command for Codex", async () => {
		const tempDir = await mkdtemp(join(homedir(), ".tmp-portable-codex-deep-"));
		const commandTargetPath = join(tempDir, ".codex", "prompts");
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
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(existsSync(join(commandTargetPath, "review-codebase-parallel.md"))).toBe(true);
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

	test("flat commands unaffected by nestedCommands flag", async () => {
		const tempDir = await mkdtemp(join(homedir(), ".tmp-portable-codex-noflat-"));
		const commandTargetPath = join(tempDir, ".codex", "prompts");
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
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(existsSync(join(commandTargetPath, "watzup.md"))).toBe(true);
		} finally {
			pathConfig.globalPath = originalGlobalPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("cross-kind section preservation (issue #415)", () => {
	beforeEach(() => {
		addPortableInstallationMock.mockClear();
		addPortableInstallationMock.mockImplementation(async () => undefined);
	});

	test("preserves agent sections when installing rules to same file", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-cross-kind-agent-rule-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const agentPathConfig = getPathConfig("opencode", "agents");
		const rulesPathConfig = getPathConfig("opencode", "rules");
		const originalAgentPath = agentPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			// First install agents
			agentPathConfig.projectPath = join(tempDir, ".opencode/agents");
			await mkdir(agentPathConfig.projectPath, { recursive: true });
			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read,Edit" },
						body: "You are a test agent.",
					}),
				],
				["opencode"],
				"agent",
				{ global: false },
			);

			// Copy the agents file to the shared location
			const agentFile = join(agentPathConfig.projectPath, "test-agent.md");
			const agentContent = await readFile(agentFile, "utf-8");
			await writeFile(targetFile, `## Agent: Test Agent\n\n${agentContent}`, "utf-8");

			// Now install rules to the same file
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
				["opencode"],
				"rules",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);

			// Verify both sections are present
			const finalContent = await readFile(targetFile, "utf-8");
			expect(finalContent).toContain("## Agent: Test Agent");
			expect(finalContent).toContain("## Rule: test-rule");
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("preserves config section when installing rules to same file", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-cross-kind-config-rule-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const configPathConfig = getPathConfig("opencode", "config");
		const rulesPathConfig = getPathConfig("opencode", "rules");
		const originalConfigPath = configPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			// First install config
			await writeFile(targetFile, "", "utf-8");
			configPathConfig.projectPath = targetFile;
			await installPortableItems(
				[
					makePortableItem({
						type: "config",
						name: "project-config",
						body: "This is project configuration.",
						frontmatter: {},
					}),
				],
				["opencode"],
				"config",
				{ global: false },
			);

			const afterConfig = await readFile(targetFile, "utf-8");
			expect(afterConfig).toContain("## Config");

			// Now install rules to the same file
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
				["opencode"],
				"rules",
				{ global: false },
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);

			// Verify both sections are present
			const finalContent = await readFile(targetFile, "utf-8");
			expect(finalContent).toContain("## Config");
			expect(finalContent).toContain("## Rule: test-rule");
		} finally {
			configPathConfig.projectPath = originalConfigPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("preserves all three kinds when re-migrating", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-cross-kind-all-three-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const agentPathConfig = getPathConfig("codex", "agents");
		const configPathConfig = getPathConfig("codex", "config");
		const rulesPathConfig = getPathConfig("codex", "rules");
		const originalAgentPath = agentPathConfig.projectPath;
		const originalConfigPath = configPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			// Install all three types to same file
			await writeFile(targetFile, "", "utf-8");
			agentPathConfig.projectPath = targetFile;
			configPathConfig.projectPath = targetFile;
			rulesPathConfig.projectPath = targetFile;

			// Install agents
			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read" },
						body: "You are a test agent.",
					}),
				],
				["codex"],
				"agent",
				{ global: false },
			);

			// Install config
			await installPortableItems(
				[
					makePortableItem({
						type: "config",
						name: "project-config",
						body: "This is project configuration.",
						frontmatter: {},
					}),
				],
				["codex"],
				"config",
				{ global: false },
			);

			// Install rules
			await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "This is a test rule.",
						frontmatter: {},
					}),
				],
				["codex"],
				"rules",
				{ global: false },
			);

			// Re-install all three again (simulating re-migration)
			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read" },
						body: "You are a test agent (updated).",
					}),
				],
				["codex"],
				"agent",
				{ global: false },
			);

			await installPortableItems(
				[
					makePortableItem({
						type: "config",
						name: "project-config",
						body: "This is project configuration (updated).",
						frontmatter: {},
					}),
				],
				["codex"],
				"config",
				{ global: false },
			);

			await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "This is a test rule (updated).",
						frontmatter: {},
					}),
				],
				["codex"],
				"rules",
				{ global: false },
			);

			// Verify all three sections are still present
			const finalContent = await readFile(targetFile, "utf-8");
			expect(finalContent).toContain("## Agent: Test Agent");
			expect(finalContent).toContain("## Config");
			expect(finalContent).toContain("## Rule: test-rule");
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			configPathConfig.projectPath = originalConfigPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("order independence: rules then agents vs agents then rules", async () => {
		const tempDir1 = await mkdtemp(join(process.cwd(), ".tmp-portable-order1-"));
		const tempDir2 = await mkdtemp(join(process.cwd(), ".tmp-portable-order2-"));
		const targetFile1 = join(tempDir1, "AGENTS.md");
		const targetFile2 = join(tempDir2, "AGENTS.md");
		const agentPathConfig = getPathConfig("opencode", "agents");
		const rulesPathConfig = getPathConfig("opencode", "rules");
		const originalAgentPath = agentPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;

		try {
			await writeFile(targetFile1, "", "utf-8");
			await writeFile(targetFile2, "", "utf-8");

			// Scenario 1: Install rules first, then agents
			agentPathConfig.projectPath = join(tempDir1, ".opencode/agents");
			rulesPathConfig.projectPath = targetFile1;
			await mkdir(agentPathConfig.projectPath, { recursive: true });

			await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "This is a test rule.",
						frontmatter: {},
					}),
				],
				["opencode"],
				"rules",
				{ global: false },
			);

			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read" },
						body: "You are a test agent.",
					}),
				],
				["opencode"],
				"agent",
				{ global: false },
			);
			// Copy agent to shared file
			const agentFile = join(agentPathConfig.projectPath, "test-agent.md");
			const agentContent = await readFile(agentFile, "utf-8");
			const existingContent = await readFile(targetFile1, "utf-8");
			await writeFile(
				targetFile1,
				`${existingContent}\n\n---\n\n## Agent: Test Agent\n\n${agentContent}`,
				"utf-8",
			);

			// Scenario 2: Install agents first, then rules
			agentPathConfig.projectPath = join(tempDir2, ".opencode/agents");
			rulesPathConfig.projectPath = targetFile2;
			await mkdir(agentPathConfig.projectPath, { recursive: true });

			await installPortableItems(
				[
					makePortableItem({
						type: "agent",
						name: "test-agent",
						frontmatter: { name: "Test Agent", tools: "Read" },
						body: "You are a test agent.",
					}),
				],
				["opencode"],
				"agent",
				{ global: false },
			);
			const agentFile2 = join(agentPathConfig.projectPath, "test-agent.md");
			const agentContent2 = await readFile(agentFile2, "utf-8");
			await writeFile(targetFile2, `## Agent: Test Agent\n\n${agentContent2}`, "utf-8");

			await installPortableItems(
				[
					makePortableItem({
						type: "rules",
						name: "test-rule",
						body: "This is a test rule.",
						frontmatter: {},
					}),
				],
				["opencode"],
				"rules",
				{ global: false },
			);

			// Both files should contain both sections
			const content1 = await readFile(targetFile1, "utf-8");
			const content2 = await readFile(targetFile2, "utf-8");

			expect(content1).toContain("## Agent: Test Agent");
			expect(content1).toContain("## Rule: test-rule");
			expect(content2).toContain("## Agent: Test Agent");
			expect(content2).toContain("## Rule: test-rule");
		} finally {
			agentPathConfig.projectPath = originalAgentPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir1, { recursive: true, force: true });
			await rm(tempDir2, { recursive: true, force: true });
		}
	});

	test("preserves custom preamble during cross-kind writes", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-preamble-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const configPathConfig = getPathConfig("goose", "config");
		const rulesPathConfig = getPathConfig("goose", "rules");
		const originalConfigPath = configPathConfig.projectPath;
		const originalRulesPath = rulesPathConfig.projectPath;
		const customPreamble = "# Custom Instructions\n\nThis is my custom preamble text.";

		try {
			// Create file with custom preamble and a config section
			await writeFile(
				targetFile,
				`${customPreamble}\n\n---\n\n## Config\n\nOriginal config.`,
				"utf-8",
			);

			configPathConfig.projectPath = targetFile;
			rulesPathConfig.projectPath = targetFile;

			// Install rules
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

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);

			// Verify preamble and both sections are preserved
			const finalContent = await readFile(targetFile, "utf-8");
			expect(finalContent).toContain("Custom Instructions");
			expect(finalContent).toContain("custom preamble text");
			expect(finalContent).toContain("## Config");
			expect(finalContent).toContain("## Rule: test-rule");
		} finally {
			configPathConfig.projectPath = originalConfigPath;
			rulesPathConfig.projectPath = originalRulesPath;
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
