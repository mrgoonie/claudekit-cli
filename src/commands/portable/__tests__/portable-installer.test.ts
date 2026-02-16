import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { computeContentChecksum } from "../checksum-utils.js";
import { convertItem } from "../converters/index.js";
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

	test("preserves cross-kind sections with content integrity", async () => {
		const tempDir = await mkdtemp(join(process.cwd(), ".tmp-portable-cross-kind-integrity-"));
		const targetFile = join(tempDir, "AGENTS.md");
		const agentPathConfig = getPathConfig("codex", "agents");
		const rulesPathConfig = getPathConfig("codex", "rules");
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
				["codex"],
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
				["codex"],
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
		const configPathConfig = getPathConfig("codex", "config");
		const rulesPathConfig = getPathConfig("codex", "rules");
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
				["codex"],
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
				["codex"],
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
		const agentPathConfig = getPathConfig("codex", "agents");
		const rulesPathConfig = getPathConfig("codex", "rules");
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
				["codex"],
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
				["codex"],
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
		const rulesPathConfig = getPathConfig("codex", "rules");
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
				["codex"],
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
		const agentPathConfig = getPathConfig("codex", "agents");
		const configPathConfig = getPathConfig("codex", "config");
		const rulesPathConfig = getPathConfig("codex", "rules");
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
				["codex"],
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
				["codex"],
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
				["codex"],
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
				["codex"],
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
				["codex"],
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
				["codex"],
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
		const agentPathConfig = getPathConfig("codex", "agents");
		const rulesPathConfig = getPathConfig("codex", "rules");
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
				["codex"],
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
				["codex"],
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
				["codex"],
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
				["codex"],
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
		const agentPathConfig = getPathConfig("codex", "agents");
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
				["codex"],
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
});
