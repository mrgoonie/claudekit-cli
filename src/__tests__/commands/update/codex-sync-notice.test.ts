import { describe, expect, test } from "bun:test";
import {
	codexSyncNotice,
	renderCodexSyncNotice,
	shouldShowCodexSyncNotice,
} from "@/commands/update/codex-sync-notice.js";

// biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI color codes
const ANSI = /\[[0-9;]*m/g;
const strip = (text: string) => text.replace(ANSI, "");

describe("shouldShowCodexSyncNotice", () => {
	test("shows when Codex is installed and auto-migrate is off", () => {
		expect(shouldShowCodexSyncNotice({ providers: ["codex"], autoMigrateEnabled: false })).toBe(
			true,
		);
	});

	test("hides when auto-migrate is already enabled", () => {
		expect(shouldShowCodexSyncNotice({ providers: ["codex"], autoMigrateEnabled: true })).toBe(
			false,
		);
	});

	test("hides when Codex is not installed", () => {
		expect(
			shouldShowCodexSyncNotice({ providers: ["cursor", "windsurf"], autoMigrateEnabled: false }),
		).toBe(false);
	});

	test("hides when no providers are detected", () => {
		expect(shouldShowCodexSyncNotice({ providers: [], autoMigrateEnabled: false })).toBe(false);
	});
});

describe("codexSyncNotice content", () => {
	test("explains the value in plain, ASCII-only language", () => {
		const text = [codexSyncNotice.title, codexSyncNotice.body].join("\n");
		// ASCII-only — no emoji (design-principles terminal constraint).
		// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ASCII range check
		expect(/[^\x00-\x7F]/.test(text)).toBe(false);
		expect(codexSyncNotice.body).toContain("agents");
		expect(codexSyncNotice.body).toContain("commands");
		expect(codexSyncNotice.body).toContain("skills");
	});

	test("CLI-first: the sync command is the primary action", () => {
		expect(codexSyncNotice.actions[0]?.command).toBe("ck migrate --agent codex");
		expect(codexSyncNotice.actions.map((a) => a.command)).toContain("ck config");
	});
});

describe("renderCodexSyncNotice", () => {
	test("renders non-empty lines containing the title and both commands", () => {
		const rendered = strip(renderCodexSyncNotice().join("\n"));
		expect(renderCodexSyncNotice().length).toBeGreaterThan(0);
		expect(rendered).toContain("Codex sync available");
		expect(rendered).toContain("ck migrate --agent codex");
		expect(rendered).toContain("ck config");
	});
});
