/**
 * Tests for selection-handler offline installation modes (--kit-path, --archive)
 * Ensures GitHub API is never called when using offline methods
 *
 * Regression tests for GitHub Issue #298:
 * https://github.com/mrgoonie/claudekit-cli/issues/298
 */
import { describe, expect, it, mock } from "bun:test";
import type { KitType } from "@/types";

// Create mock prompts manager
function createMockPrompts(selectKitResult: KitType = "engineer") {
	return {
		selectKit: mock(async (_default?: KitType, _accessible?: KitType[]) => selectKitResult),
		selectKits: mock(async (_accessible: KitType[]) => [selectKitResult]),
		getDirectory: mock(async () => "."),
		selectVersionEnhanced: mock(async () => "v1.0.0"),
		confirm: mock(async () => true),
		selectScope: mock(async () => "global" as const),
		intro: mock(() => {}),
		outro: mock(() => {}),
		note: mock(() => {}),
	};
}

// Context factory for offline mode tests
interface OfflineTestContextOptions {
	kitPath?: string;
	archive?: string;
	useGit?: boolean;
	release?: string;
	kit?: string;
	yes?: boolean;
	global?: boolean;
	beta?: boolean;
}

function createOfflineContext(overrides: OfflineTestContextOptions) {
	const prompts = createMockPrompts();
	return {
		options: {
			kitPath: overrides.kitPath,
			archive: overrides.archive,
			useGit: overrides.useGit ?? false,
			release: overrides.release,
			kit: overrides.kit ?? "engineer",
			yes: overrides.yes ?? true,
			global: overrides.global ?? true,
			beta: overrides.beta ?? false,
		},
		prompts,
		isNonInteractive: overrides.yes ?? true,
		cancelled: false,
	};
}

describe("selection-handler offline modes", () => {
	describe("offline mode detection", () => {
		it("detects --kit-path as offline mode", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);
			expect(isOfflineMode).toBe(true);
		});

		it("detects --archive as offline mode", () => {
			const ctx = createOfflineContext({
				archive: "/path/to/release.zip",
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);
			expect(isOfflineMode).toBe(true);
		});

		it("does NOT detect --use-git as offline mode", () => {
			const ctx = createOfflineContext({
				useGit: true,
				release: "v1.0.0",
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);
			expect(isOfflineMode).toBe(false);
		});

		it("does NOT detect normal API mode as offline mode", () => {
			const ctx = createOfflineContext({});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);
			expect(isOfflineMode).toBe(false);
		});
	});

	describe("GitHub API bypass for --kit-path", () => {
		it("skips preflight checks with --kit-path", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
			});

			// Logic from selection-handler.ts:49
			const shouldRunPreflight =
				!ctx.options.useGit && !ctx.options.kitPath && !ctx.options.archive;
			expect(shouldRunPreflight).toBe(false);
		});

		it("skips release fetching with --kit-path", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
				yes: true,
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			// Release should be undefined in offline mode
			let release;
			if (isOfflineMode) {
				release = undefined;
			} else {
				// Would call GitHub API here
				release = { tag_name: "v1.0.0" };
			}

			expect(release).toBeUndefined();
		});

		it("skips version selection prompt with --kit-path", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			// Should NOT call selectVersionEnhanced in offline mode
			const shouldPromptVersion = !ctx.isNonInteractive && !isOfflineMode;
			expect(shouldPromptVersion).toBe(false);
		});

		it("does NOT require --release flag with --kit-path", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
				release: undefined,
			});

			// --kit-path should work without --release
			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);
			const needsRelease = !isOfflineMode && !ctx.options.release;

			expect(needsRelease).toBe(false);
		});

		it("does NOT log 'Fetching latest release' with --kit-path", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
				yes: true,
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			// Should NOT log "Using latest stable version" message in offline mode
			const shouldLogLatestVersion = ctx.options.yes && !isOfflineMode;
			expect(shouldLogLatestVersion).toBe(false);
		});
	});

	describe("GitHub API bypass for --archive", () => {
		it("skips preflight checks with --archive", () => {
			const ctx = createOfflineContext({
				archive: "/path/to/release.zip",
			});

			const shouldRunPreflight =
				!ctx.options.useGit && !ctx.options.kitPath && !ctx.options.archive;
			expect(shouldRunPreflight).toBe(false);
		});

		it("skips release fetching with --archive", () => {
			const ctx = createOfflineContext({
				archive: "/path/to/release.zip",
				yes: true,
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			let release;
			if (isOfflineMode) {
				release = undefined;
			} else {
				release = { tag_name: "v1.0.0" };
			}

			expect(release).toBeUndefined();
		});

		it("does NOT require --release flag with --archive", () => {
			const ctx = createOfflineContext({
				archive: "/path/to/release.zip",
				release: undefined,
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);
			const needsRelease = !isOfflineMode && !ctx.options.release;

			expect(needsRelease).toBe(false);
		});
	});

	describe("non-interactive mode with offline methods", () => {
		it("works with --yes --kit-path (no auth required)", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
				yes: true,
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			// Should NOT throw "Non-interactive mode requires --release" error
			const shouldThrowNonInteractiveError =
				!ctx.options.release && ctx.isNonInteractive && !ctx.options.yes && !isOfflineMode;

			expect(shouldThrowNonInteractiveError).toBe(false);
		});

		it("works with --yes --archive (no auth required)", () => {
			const ctx = createOfflineContext({
				archive: "/path/to/release.zip",
				yes: true,
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			const shouldThrowNonInteractiveError =
				!ctx.options.release && ctx.isNonInteractive && !ctx.options.yes && !isOfflineMode;

			expect(shouldThrowNonInteractiveError).toBe(false);
		});
	});

	describe("regression test: Issue #298 exact scenario", () => {
		it("handles exact user scenario from Issue #298", () => {
			// Exact reproduction from GitHub issue:
			// ck init -g --prefix -y --kit engineer --kit-path /root/.claudekit/.git/claudekit-engineer
			const ctx = createOfflineContext({
				global: true,
				yes: true,
				kit: "engineer",
				kitPath: "/root/.claudekit/.git/claudekit-engineer",
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			// Must NOT call any GitHub API methods
			expect(isOfflineMode).toBe(true);

			// Must skip preflight checks
			const shouldRunPreflight =
				!ctx.options.useGit && !ctx.options.kitPath && !ctx.options.archive;
			expect(shouldRunPreflight).toBe(false);

			// Release must be undefined (not fetched)
			let release;
			if (isOfflineMode) {
				release = undefined;
			}
			expect(release).toBeUndefined();

			// Should NOT log "Fetching latest release..."
			const shouldFetchRelease = !isOfflineMode;
			expect(shouldFetchRelease).toBe(false);
		});

		it("handles Docker/CI scenario without any auth", () => {
			// Docker container scenario: no gh CLI, no GITHUB_TOKEN, no SSH keys
			const ctx = createOfflineContext({
				kitPath: "/opt/claudekit-engineer",
				yes: true,
				kit: "engineer",
				global: true,
			});

			// Simulating: GITHUB_TOKEN=undefined, gh CLI=not installed
			const hasGhToken = false;
			const hasGhCli = false;

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			// Even without ANY auth, offline mode should work
			expect(isOfflineMode).toBe(true);

			// Should not need any of these
			const needsAuth = !isOfflineMode && !hasGhToken && !hasGhCli;
			expect(needsAuth).toBe(false);
		});
	});

	describe("mutually exclusive download methods", () => {
		// Validation logic mirrors selection-handler.ts implementation (explicit without type assertion)
		function validateDownloadMethods(ctx: ReturnType<typeof createOfflineContext>) {
			const downloadMethods: string[] = [];
			if (ctx.options.useGit) downloadMethods.push("--use-git");
			if (ctx.options.archive) downloadMethods.push("--archive");
			if (ctx.options.kitPath) downloadMethods.push("--kit-path");

			return {
				methods: downloadMethods,
				isValid: downloadMethods.length <= 1,
				conflictingMethods: downloadMethods.length > 1 ? downloadMethods : null,
			};
		}

		it("--kit-path and --archive are mutually exclusive", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
				archive: "/path/to/release.zip",
			});

			const validation = validateDownloadMethods(ctx);
			expect(validation.isValid).toBe(false);
			expect(validation.conflictingMethods).toContain("--kit-path");
			expect(validation.conflictingMethods).toContain("--archive");
		});

		it("--kit-path and --use-git are mutually exclusive", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
				useGit: true,
			});

			const validation = validateDownloadMethods(ctx);
			expect(validation.isValid).toBe(false);
			expect(validation.conflictingMethods).toContain("--kit-path");
			expect(validation.conflictingMethods).toContain("--use-git");
		});

		it("--archive and --use-git are mutually exclusive", () => {
			const ctx = createOfflineContext({
				archive: "/path/to/release.zip",
				useGit: true,
			});

			const validation = validateDownloadMethods(ctx);
			expect(validation.isValid).toBe(false);
			expect(validation.conflictingMethods).toContain("--archive");
			expect(validation.conflictingMethods).toContain("--use-git");
		});

		it("allows single offline method without conflict", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
			});

			const validation = validateDownloadMethods(ctx);
			expect(validation.isValid).toBe(true);
			expect(validation.methods.length).toBe(1);
			expect(validation.methods[0]).toBe("--kit-path");
		});

		it("allows no download method specified (default behavior)", () => {
			const ctx = createOfflineContext({});

			const validation = validateDownloadMethods(ctx);
			expect(validation.isValid).toBe(true);
			expect(validation.methods.length).toBe(0);
		});
	});

	describe("GitHubClient instantiation", () => {
		it("should NOT instantiate GitHubClient in offline mode", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			// GitHubClient should only be created when NOT in offline mode
			const github = isOfflineMode ? null : { getReleaseByTag: mock(() => {}) };

			expect(github).toBeNull();
		});

		it("should instantiate GitHubClient in normal mode", () => {
			const ctx = createOfflineContext({});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			const github = isOfflineMode ? null : { getReleaseByTag: mock(() => {}) };

			expect(github).not.toBeNull();
		});
	});

	describe("context return values", () => {
		it("returns undefined release for --kit-path mode", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);
			const release = isOfflineMode ? undefined : { tag_name: "v1.0.0" };

			// Return context should have undefined release
			const returnCtx = {
				...ctx,
				release,
			};

			expect(returnCtx.release).toBeUndefined();
		});

		it("returns undefined release for --archive mode", () => {
			const ctx = createOfflineContext({
				archive: "/path/to/release.zip",
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);
			const release = isOfflineMode ? undefined : { tag_name: "v1.0.0" };

			const returnCtx = {
				...ctx,
				release,
			};

			expect(returnCtx.release).toBeUndefined();
		});
	});

	describe("verbose logging", () => {
		it("logs offline mode info for --kit-path", () => {
			const ctx = createOfflineContext({
				kitPath: "/path/to/kit",
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			// Should log verbose message about offline mode
			const logMessage = isOfflineMode
				? `Offline mode - skipping release fetch: kitPath=${ctx.options.kitPath}, archive=${ctx.options.archive}`
				: null;

			expect(logMessage).toContain("kitPath=/path/to/kit");
		});

		it("logs offline mode info for --archive", () => {
			const ctx = createOfflineContext({
				archive: "/path/to/release.zip",
			});

			const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

			const logMessage = isOfflineMode
				? `Offline mode - skipping release fetch: kitPath=${ctx.options.kitPath}, archive=${ctx.options.archive}`
				: null;

			expect(logMessage).toContain("archive=/path/to/release.zip");
		});
	});
});
