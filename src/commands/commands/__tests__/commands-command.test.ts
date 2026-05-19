import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PortableRegistryV3 } from "../../portable/portable-registry.js";

const emptyRegistry = (): PortableRegistryV3 => ({ version: "3.0", installations: [] });
const readPortableRegistryMock = mock(async (): Promise<PortableRegistryV3> => emptyRegistry());
const removePortableInstallationMock = mock(async () => null);
const syncPortableRegistryMock = mock(async () => ({ removed: [] }));
const registryDeps = {
	readPortableRegistry: readPortableRegistryMock,
	removePortableInstallation: removePortableInstallationMock,
	syncPortableRegistry: syncPortableRegistryMock,
};

mock.module("@clack/prompts", () => ({
	intro: mock(() => undefined),
	outro: mock(() => undefined),
	isCancel: mock(() => false),
	confirm: mock(async () => true),
	multiselect: mock(async () => []),
	select: mock(async () => false),
	spinner: mock(() => ({
		start: mock(() => undefined),
		stop: mock(() => undefined),
	})),
	cancel: mock(() => undefined),
	log: {
		error: mock(() => undefined),
		info: mock(() => undefined),
		message: mock(() => undefined),
		step: mock(() => undefined),
		success: mock(() => undefined),
		warn: mock(() => undefined),
	},
}));

const { commandsCommand } = await import("../commands-command.js");
const { providers } = await import("../../portable/provider-registry.js");
mock.restore();

describe("commandsCommand force uninstall", () => {
	const codexCommandPaths = providers.codex.commands;
	if (!codexCommandPaths) {
		throw new Error("Codex commands provider config is missing");
	}
	const originalProjectPath = codexCommandPaths.projectPath;
	const originalGlobalPath = codexCommandPaths.globalPath;
	let tempDir: string | null = null;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-commands-command-"));
		codexCommandPaths.projectPath = join(tempDir, "project", ".agents", "skills");
		codexCommandPaths.globalPath = join(tempDir, "home", ".agents", "skills");
		readPortableRegistryMock.mockClear();
		readPortableRegistryMock.mockImplementation(async () => emptyRegistry());
		removePortableInstallationMock.mockClear();
	});

	afterEach(async () => {
		codexCommandPaths.projectPath = originalProjectPath;
		codexCommandPaths.globalPath = originalGlobalPath;
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = null;
		}
	});

	test("defaults untracked Codex command force uninstall to project scope", async () => {
		const projectSkillPath = join(
			codexCommandPaths.projectPath ?? "",
			"source-command-local",
			"SKILL.md",
		);
		const globalSkillPath = join(
			codexCommandPaths.globalPath ?? "",
			"source-command-local",
			"SKILL.md",
		);
		await mkdir(join(codexCommandPaths.projectPath ?? "", "source-command-local"), {
			recursive: true,
		});
		await mkdir(join(codexCommandPaths.globalPath ?? "", "source-command-local"), {
			recursive: true,
		});
		await writeFile(projectSkillPath, "---\nname: source-command-local\n---\n", "utf-8");
		await writeFile(globalSkillPath, "---\nname: source-command-local\n---\n", "utf-8");

		await commandsCommand({
			uninstall: true,
			force: true,
			name: "local",
			agent: ["codex"],
			yes: true,
			registry: registryDeps,
		});

		expect(existsSync(projectSkillPath)).toBe(false);
		expect(existsSync(globalSkillPath)).toBe(true);
		expect(removePortableInstallationMock).toHaveBeenCalledWith("local", "command", "codex", false);
	});

	test("keeps explicit global scope for untracked Codex command force uninstall", async () => {
		const projectSkillPath = join(
			codexCommandPaths.projectPath ?? "",
			"source-command-local",
			"SKILL.md",
		);
		const globalSkillPath = join(
			codexCommandPaths.globalPath ?? "",
			"source-command-local",
			"SKILL.md",
		);
		await mkdir(join(codexCommandPaths.projectPath ?? "", "source-command-local"), {
			recursive: true,
		});
		await mkdir(join(codexCommandPaths.globalPath ?? "", "source-command-local"), {
			recursive: true,
		});
		await writeFile(projectSkillPath, "---\nname: source-command-local\n---\n", "utf-8");
		await writeFile(globalSkillPath, "---\nname: source-command-local\n---\n", "utf-8");

		await commandsCommand({
			uninstall: true,
			force: true,
			name: "local",
			agent: ["codex"],
			global: true,
			yes: true,
			registry: registryDeps,
		});

		expect(existsSync(globalSkillPath)).toBe(false);
		expect(existsSync(projectSkillPath)).toBe(true);
		expect(removePortableInstallationMock).toHaveBeenCalledWith("local", "command", "codex", true);
	});
});
