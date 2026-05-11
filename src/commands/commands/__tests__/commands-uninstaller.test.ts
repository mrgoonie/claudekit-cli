import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PortableRegistryV3 } from "../../portable/portable-registry.js";

const removePortableInstallationMock = mock(async () => null);
const emptyRegistry = (): PortableRegistryV3 => ({ version: "3.0", installations: [] });
const readPortableRegistryMock = mock(async (): Promise<PortableRegistryV3> => emptyRegistry());
const actualPortableRegistry = await import("../../portable/portable-registry.js");

mock.module("../../portable/portable-registry.js", () => ({
	...actualPortableRegistry,
	readPortableRegistry: readPortableRegistryMock,
	removePortableInstallation: removePortableInstallationMock,
}));

const { forceUninstallCommandFromProvider, uninstallCommandFromProvider } = await import(
	"../commands-uninstaller.js"
);
const { providers } = await import("../../portable/provider-registry.js");

const codexCommandPaths = providers.codex.commands;
if (!codexCommandPaths) {
	throw new Error("Codex commands provider config is missing");
}
const originalProjectPath = codexCommandPaths.projectPath;
const originalGlobalPath = codexCommandPaths.globalPath;
let tempDir: string | null = null;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "ck-commands-uninstaller-"));
	codexCommandPaths.projectPath = join(tempDir, "project", ".agents", "skills");
	codexCommandPaths.globalPath = join(tempDir, "home", ".agents", "skills");
	removePortableInstallationMock.mockClear();
	readPortableRegistryMock.mockClear();
	readPortableRegistryMock.mockImplementation(
		async (): Promise<PortableRegistryV3> => emptyRegistry(),
	);
});

afterEach(async () => {
	codexCommandPaths.projectPath = originalProjectPath;
	codexCommandPaths.globalPath = originalGlobalPath;
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true });
		tempDir = null;
	}
});

afterAll(() => {
	mock.restore();
});

describe("forceUninstallCommandFromProvider", () => {
	test("rejects traversal command names without deleting outside provider base", async () => {
		const basePath = codexCommandPaths.projectPath ?? "";
		const outsidePath = join(basePath, "..", "..", "AGENTS.md");
		await mkdir(join(basePath, "..", ".."), { recursive: true });
		await writeFile(outsidePath, "keep me", "utf-8");

		const result = await forceUninstallCommandFromProvider("../../AGENTS", "codex", false);

		expect(result.success).toBe(false);
		expect(result.error).toBe("Invalid command name");
		expect(existsSync(outsidePath)).toBe(true);
		expect(removePortableInstallationMock).not.toHaveBeenCalled();
	});

	test("rejects registry paths that escape provider command base", async () => {
		const basePath = codexCommandPaths.projectPath ?? "";
		const outsidePath = join(basePath, "..", "..", "outside.md");
		await mkdir(join(basePath, "..", ".."), { recursive: true });
		await writeFile(outsidePath, "outside", "utf-8");
		readPortableRegistryMock.mockImplementation(
			async (): Promise<PortableRegistryV3> => ({
				version: "3.0" as const,
				installations: [
					{
						item: "local",
						type: "command" as const,
						provider: "codex" as const,
						global: false,
						path: outsidePath,
						installedAt: new Date(0).toISOString(),
						sourcePath: ".claude/commands/local.md",
						sourceChecksum: "unknown",
						targetChecksum: "unknown",
						installSource: "kit" as const,
					},
				],
			}),
		);

		const result = await uninstallCommandFromProvider("local", "codex", false);

		expect(result.success).toBe(false);
		expect(result.error).toContain("escapes provider command directory");
		expect(existsSync(outsidePath)).toBe(true);
		expect(removePortableInstallationMock).not.toHaveBeenCalled();
	});

	test("does not remove the Codex skills base directory for malformed registry paths", async () => {
		const basePath = codexCommandPaths.projectPath ?? "";
		const unsafeSkillPath = join(basePath, "SKILL.md");
		const siblingSkillDir = join(basePath, "source-command-safe");
		const siblingSkillPath = join(siblingSkillDir, "SKILL.md");
		await mkdir(siblingSkillDir, { recursive: true });
		await writeFile(unsafeSkillPath, "---\nname: malformed\n---\n", "utf-8");
		await writeFile(siblingSkillPath, "---\nname: source-command-safe\n---\n", "utf-8");
		readPortableRegistryMock.mockImplementation(
			async (): Promise<PortableRegistryV3> => ({
				version: "3.0" as const,
				installations: [
					{
						item: "local",
						type: "command" as const,
						provider: "codex" as const,
						global: false,
						path: unsafeSkillPath,
						installedAt: new Date(0).toISOString(),
						sourcePath: ".claude/commands/local.md",
						sourceChecksum: "unknown",
						targetChecksum: "unknown",
						installSource: "kit" as const,
					},
				],
			}),
		);

		const result = await uninstallCommandFromProvider("local", "codex", false);

		expect(result.success).toBe(true);
		expect(existsSync(unsafeSkillPath)).toBe(false);
		expect(existsSync(basePath)).toBe(true);
		expect(existsSync(siblingSkillPath)).toBe(true);
		expect(removePortableInstallationMock).toHaveBeenCalledWith("local", "command", "codex", false);
	});

	test("removes project-scoped Codex command skills", async () => {
		const skillDir = join(codexCommandPaths.projectPath ?? "", "source-command-local");
		const skillPath = join(skillDir, "SKILL.md");
		await mkdir(skillDir, { recursive: true });
		await writeFile(skillPath, "---\nname: source-command-local\n---\n", "utf-8");

		const result = await forceUninstallCommandFromProvider("local", "codex", false);

		expect(result.success).toBe(true);
		expect(result.path).toBe(skillPath);
		expect(existsSync(skillPath)).toBe(false);
		expect(existsSync(skillDir)).toBe(false);
		expect(removePortableInstallationMock).toHaveBeenCalledWith("local", "command", "codex", false);
	});

	test("removes tracked legacy project Codex prompt commands", async () => {
		const legacyPromptPath = join(tempDir ?? "", "project", ".codex", "prompts", "local.md");
		await mkdir(join(tempDir ?? "", "project", ".codex", "prompts"), { recursive: true });
		await writeFile(legacyPromptPath, "# Legacy Codex prompt\n", "utf-8");
		readPortableRegistryMock.mockImplementation(
			async (): Promise<PortableRegistryV3> => ({
				version: "3.0" as const,
				installations: [
					{
						item: "local",
						type: "command" as const,
						provider: "codex" as const,
						global: false,
						path: legacyPromptPath,
						installedAt: new Date(0).toISOString(),
						sourcePath: ".claude/commands/local.md",
						sourceChecksum: "unknown",
						targetChecksum: "unknown",
						installSource: "kit" as const,
					},
				],
			}),
		);

		const result = await uninstallCommandFromProvider("local", "codex", false);

		expect(result.success).toBe(true);
		expect(result.path).toBe(legacyPromptPath);
		expect(existsSync(legacyPromptPath)).toBe(false);
		expect(removePortableInstallationMock).toHaveBeenCalledWith("local", "command", "codex", false);
	});

	test("rejects symlinked legacy Codex prompt parent before deletion", async () => {
		const projectRoot = join(tempDir ?? "", "project");
		const outsidePromptsDir = join(tempDir ?? "", "outside-prompts");
		const legacyPromptPath = join(projectRoot, ".codex", "prompts", "local.md");
		const outsidePromptPath = join(outsidePromptsDir, "local.md");
		await mkdir(join(projectRoot, ".codex"), { recursive: true });
		await mkdir(outsidePromptsDir, { recursive: true });
		await symlink(outsidePromptsDir, join(projectRoot, ".codex", "prompts"), "dir");
		await writeFile(outsidePromptPath, "# Outside prompt\n", "utf-8");
		readPortableRegistryMock.mockImplementation(
			async (): Promise<PortableRegistryV3> => ({
				version: "3.0" as const,
				installations: [
					{
						item: "local",
						type: "command" as const,
						provider: "codex" as const,
						global: false,
						path: legacyPromptPath,
						installedAt: new Date(0).toISOString(),
						sourcePath: ".claude/commands/local.md",
						sourceChecksum: "unknown",
						targetChecksum: "unknown",
						installSource: "kit" as const,
					},
				],
			}),
		);

		const result = await uninstallCommandFromProvider("local", "codex", false);

		expect(result.success).toBe(false);
		expect(result.error).toContain("symlink");
		expect(existsSync(outsidePromptPath)).toBe(true);
		expect(removePortableInstallationMock).not.toHaveBeenCalled();
	});

	test("removes global nested Codex command skills without touching project scope", async () => {
		const globalSkillPath = join(
			codexCommandPaths.globalPath ?? "",
			"source-command-review-codebase",
			"SKILL.md",
		);
		const projectSkillPath = join(
			codexCommandPaths.projectPath ?? "",
			"source-command-review-codebase",
			"SKILL.md",
		);
		await mkdir(join(codexCommandPaths.globalPath ?? "", "source-command-review-codebase"), {
			recursive: true,
		});
		await mkdir(join(codexCommandPaths.projectPath ?? "", "source-command-review-codebase"), {
			recursive: true,
		});
		await writeFile(globalSkillPath, "---\nname: source-command-review-codebase\n---\n", "utf-8");
		await writeFile(projectSkillPath, "---\nname: source-command-review-codebase\n---\n", "utf-8");

		const result = await forceUninstallCommandFromProvider("review/codebase", "codex", true);

		expect(result.success).toBe(true);
		expect(result.path).toBe(globalSkillPath);
		expect(existsSync(globalSkillPath)).toBe(false);
		expect(existsSync(projectSkillPath)).toBe(true);
		expect(removePortableInstallationMock).toHaveBeenCalledWith(
			"review/codebase",
			"command",
			"codex",
			true,
		);
	});

	test("removes legacy nested Codex command markdown files", async () => {
		const legacyDir = join(codexCommandPaths.projectPath ?? "", "review");
		const legacyPath = join(legacyDir, "codebase.md");
		await mkdir(legacyDir, { recursive: true });
		await writeFile(legacyPath, "# Legacy nested command\n", "utf-8");

		const result = await forceUninstallCommandFromProvider("review/codebase", "codex", false);

		expect(result.success).toBe(true);
		expect(result.path).toBe(legacyPath);
		expect(existsSync(legacyPath)).toBe(false);
		expect(removePortableInstallationMock).toHaveBeenCalledWith(
			"review/codebase",
			"command",
			"codex",
			false,
		);
	});

	test("removes legacy flattened Codex command markdown files", async () => {
		const legacyPath = join(codexCommandPaths.projectPath ?? "", "review-codebase.md");
		await mkdir(codexCommandPaths.projectPath ?? "", { recursive: true });
		await writeFile(legacyPath, "# Legacy flat command\n", "utf-8");

		const result = await forceUninstallCommandFromProvider("review/codebase", "codex", false);

		expect(result.success).toBe(true);
		expect(result.path).toBe(legacyPath);
		expect(existsSync(legacyPath)).toBe(false);
		expect(removePortableInstallationMock).toHaveBeenCalledWith(
			"review/codebase",
			"command",
			"codex",
			false,
		);
	});
});
