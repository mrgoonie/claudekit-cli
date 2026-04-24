/**
 * Integration tests for ck migrate — P5 flag surface
 *
 * Tests cover:
 *   - Mutual exclusion: --install + --reconcile → error
 *   - Mutual exclusion: --reinstall-empty-dirs + --respect-deletions → error
 *   - resolveMigrationMode smart default logic
 *   - renderBanners output correctness
 *   - renderBannerLines formatting
 *   - validateMutualExclusion guard
 */
import { describe, expect, it } from "bun:test";
import type { ReconcileBanner } from "../../portable/reconcile-types.js";
import type { MigrateOptions } from "../migrate-command.js";
import {
	renderBanners,
	resolveMigrationMode,
	validateMutualExclusion,
} from "../migrate-command.js";
import { renderBannerLines } from "../migrate-ui-summary.js";

// ---------------------------------------------------------------------------
// validateMutualExclusion
// ---------------------------------------------------------------------------

describe("validateMutualExclusion", () => {
	it("returns null when neither install nor reconcile set", () => {
		const opts: MigrateOptions = {};
		expect(validateMutualExclusion(opts)).toBeNull();
	});

	it("returns null when only --install set", () => {
		expect(validateMutualExclusion({ install: true })).toBeNull();
	});

	it("returns null when only --reconcile set", () => {
		expect(validateMutualExclusion({ reconcile: true })).toBeNull();
	});

	it("returns error string when both --install and --reconcile set", () => {
		const result = validateMutualExclusion({ install: true, reconcile: true });
		expect(result).toContain("--install");
		expect(result).toContain("--reconcile");
	});

	it("returns null when only --reinstall-empty-dirs set", () => {
		expect(validateMutualExclusion({ reinstallEmptyDirs: true })).toBeNull();
	});

	it("returns null when only --respect-deletions set", () => {
		expect(validateMutualExclusion({ respectDeletions: true })).toBeNull();
	});

	it("returns error string when both --reinstall-empty-dirs and --respect-deletions set", () => {
		const result = validateMutualExclusion({
			reinstallEmptyDirs: true,
			respectDeletions: true,
		});
		expect(result).toContain("--reinstall-empty-dirs");
		expect(result).toContain("--respect-deletions");
	});

	it("does NOT trigger reinstall+respect conflict when reinstallEmptyDirs is false", () => {
		// reinstallEmptyDirs=false is the equivalent of not passing --reinstall-empty-dirs
		// The conflict only triggers when both truthy flags are set
		expect(
			validateMutualExclusion({ reinstallEmptyDirs: false, respectDeletions: true }),
		).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// resolveMigrationMode
// ---------------------------------------------------------------------------

describe("resolveMigrationMode", () => {
	it("returns 'install' when --install flag set", () => {
		expect(resolveMigrationMode({ install: true }, false)).toBe("install");
	});

	it("returns 'install' even when --install set and registry has no unknown checksums", () => {
		expect(resolveMigrationMode({ install: true }, false)).toBe("install");
	});

	it("returns 'reconcile' when --reconcile flag set", () => {
		expect(resolveMigrationMode({ reconcile: true }, false)).toBe("reconcile");
	});

	it("returns 'reconcile' when --reconcile set regardless of unknown checksums", () => {
		expect(resolveMigrationMode({ reconcile: true }, true)).toBe("reconcile");
	});

	it("returns 'install' when no flags set and registry has unknown checksums (smart default)", () => {
		expect(resolveMigrationMode({}, true)).toBe("install");
	});

	it("returns 'reconcile' when no flags set and registry has no unknown checksums", () => {
		expect(resolveMigrationMode({}, false)).toBe("reconcile");
	});

	it("--install takes precedence over unknown checksum smart default", () => {
		expect(resolveMigrationMode({ install: true }, true)).toBe("install");
	});

	it("--reconcile takes precedence even when registry has unknown checksums", () => {
		// Explicit reconcile overrides smart default
		expect(resolveMigrationMode({ reconcile: true }, true)).toBe("reconcile");
	});
});

// ---------------------------------------------------------------------------
// renderBannerLines
// ---------------------------------------------------------------------------

describe("renderBannerLines", () => {
	const emptyDirBanner: ReconcileBanner = {
		kind: "empty-dir",
		provider: "claude-code",
		type: "hooks",
		global: true,
		path: "/home/user/.codex/hooks",
		itemCount: 3,
		message: "empty dir detected",
	};

	const respectedBanner: ReconcileBanner = {
		kind: "empty-dir-respected",
		provider: "claude-code",
		type: "hooks",
		global: true,
		path: "/home/user/.codex/hooks",
		itemCount: 3,
		message: "empty dir respected",
	};

	it("renders empty-dir banner with [i] prefix and item count", () => {
		const lines = renderBannerLines(emptyDirBanner);
		expect(lines.length).toBeGreaterThan(0);
		const joined = lines.join("\n");
		expect(joined).toContain("[i]");
		expect(joined).toContain("3 item(s)");
		expect(joined).toContain("--respect-deletions");
	});

	it("renders empty-dir banner with display path (~ substitution via HOME)", () => {
		const homeDir = process.env.HOME ?? "";
		const banner: ReconcileBanner = {
			...emptyDirBanner,
			path: `${homeDir}/.codex/hooks`,
		};
		const lines = renderBannerLines(banner);
		const joined = lines.join("\n");
		// Path should use ~ if HOME was substituted
		if (homeDir) {
			expect(joined).toContain("~/.codex/hooks");
		}
	});

	it("renders empty-dir-respected banner with skipped message", () => {
		const lines = renderBannerLines(respectedBanner);
		const joined = lines.join("\n");
		expect(joined).toContain("[i]");
		expect(joined).toContain("3 item(s) skipped");
		expect(joined).toContain("--respect-deletions");
	});

	it("banner lines start and end with border characters", () => {
		const lines = renderBannerLines(emptyDirBanner);
		expect(lines[0]).toMatch(/^\+={1,}=\+$/);
		expect(lines[lines.length - 1]).toMatch(/^\+={1,}=\+$/);
	});

	it("returns empty array for unknown banner kind", () => {
		// Type cast to force unknown kind
		const unknownBanner = { ...emptyDirBanner, kind: "unknown-kind" } as unknown as ReconcileBanner;
		const lines = renderBannerLines(unknownBanner);
		expect(lines).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// renderBanners (stdout integration — tests output side-effects)
// ---------------------------------------------------------------------------

describe("renderBanners", () => {
	it("does not throw for empty banners array", () => {
		expect(() => renderBanners([])).not.toThrow();
	});

	it("does not throw for valid banners array", () => {
		const banner: ReconcileBanner = {
			kind: "empty-dir",
			provider: "claude-code",
			type: "hooks",
			global: true,
			path: "/tmp/hooks",
			itemCount: 2,
			message: "empty",
		};
		expect(() => renderBanners([banner])).not.toThrow();
	});

	it("does not throw for respected banner", () => {
		const banner: ReconcileBanner = {
			kind: "empty-dir-respected",
			provider: "claude-code",
			type: "hooks",
			global: true,
			path: "/tmp/hooks",
			itemCount: 1,
			message: "respected",
		};
		expect(() => renderBanners([banner])).not.toThrow();
	});
});
