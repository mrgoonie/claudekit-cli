import { describe, expect, test } from "bun:test";
import {
	codexSyncNoticeLines,
	shouldShowCodexSyncNotice,
} from "@/commands/update/codex-sync-notice.js";

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

describe("codexSyncNoticeLines", () => {
	test("is short, ASCII-only, and explains how to enable sync", () => {
		const lines = codexSyncNoticeLines();
		expect(lines.length).toBeLessThanOrEqual(2);
		const text = lines.join("\n");
		// ASCII only — no emoji (design-principles terminal constraint).
		// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ASCII range check
		expect(/[^\x00-\x7F]/.test(text)).toBe(false);
		expect(text).toContain("Codex");
		expect(text).toContain("autoMigrateAfterUpdate");
		expect(text).toContain("ck migrate");
	});
});
