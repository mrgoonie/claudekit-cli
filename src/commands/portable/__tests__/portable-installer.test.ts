import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { installPortableItems } from "../portable-installer.js";
import { providers } from "../provider-registry.js";
import type { PortableItem, ProviderPathConfig } from "../types.js";

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
