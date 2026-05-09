import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const forceUninstallCommandFromProviderMock = mock(async () => ({
	item: "local",
	provider: "codex",
	providerDisplayName: "Codex",
	global: false,
	path: ".agents/skills/source-command-local/SKILL.md",
	success: true,
}));
const readPortableRegistryMock = mock(async () => ({ installations: [] }));
const syncPortableRegistryMock = mock(async () => ({ removed: [] }));

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

mock.module("../../portable/portable-registry.js", () => ({
	readPortableRegistry: readPortableRegistryMock,
	syncPortableRegistry: syncPortableRegistryMock,
}));

mock.module("../commands-uninstaller.js", () => ({
	forceUninstallCommandFromProvider: forceUninstallCommandFromProviderMock,
	getInstalledCommands: mock(async () => []),
	uninstallCommandFromProvider: mock(async () => ({ success: true })),
}));

const { commandsCommand } = await import("../commands-command.js");

afterAll(() => {
	mock.restore();
});

describe("commandsCommand force uninstall", () => {
	beforeEach(() => {
		forceUninstallCommandFromProviderMock.mockClear();
		readPortableRegistryMock.mockClear();
		readPortableRegistryMock.mockImplementation(async () => ({ installations: [] }));
	});

	test("defaults untracked Codex command force uninstall to project scope", async () => {
		await commandsCommand({
			uninstall: true,
			force: true,
			name: "local",
			agent: ["codex"],
			yes: true,
		});

		expect(forceUninstallCommandFromProviderMock).toHaveBeenCalledWith("local", "codex", false);
	});

	test("keeps explicit global scope for untracked Codex command force uninstall", async () => {
		await commandsCommand({
			uninstall: true,
			force: true,
			name: "local",
			agent: ["codex"],
			global: true,
			yes: true,
		});

		expect(forceUninstallCommandFromProviderMock).toHaveBeenCalledWith("local", "codex", true);
	});
});
