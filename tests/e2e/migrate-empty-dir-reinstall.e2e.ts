/**
 * Scenario A — Empty-dir reinstall banner
 *
 * Simulates: ~/.codex/hooks/ directory is missing/empty even though the registry
 * has 3 hook installations. The reconciler should emit an "empty-dir" banner and
 * route all 3 hooks to the Install tab (not Skip).
 *
 * Strategy: Playwright route mocking intercepts /api/migrate/* so tests are
 * fully isolated from the real filesystem. The server's HOME binding is module-
 * scoped (portable-registry.ts:17), so API mocking is the only viable approach
 * for multi-scenario isolation without restarting the server per test.
 *
 * UI flow:
 *   1. /migrate loads → provider list (idle phase)
 *   2. Click "Select" on Codex provider card
 *   3. Click "Run Migration" → reconcile endpoint called
 *   4. Plan review renders with yellow banner + ReconcilePlanView (4 tabs)
 *   5. Click "Execute Migration" → execute endpoint called
 *   6. Summary panel shows installed count
 */

import { expect, test } from "@playwright/test";
import type { ReconcileAction, ReconcilePlan } from "../../src/ui/src/types/reconcile-types.js";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PROVIDERS = [
	{
		name: "codex",
		displayName: "Codex",
		detected: true,
		recommended: true,
		commandsGlobalOnly: false,
		capabilities: {
			agents: false,
			commands: false,
			skills: false,
			config: false,
			rules: false,
			hooks: true,
		},
	},
];

const HOOK_ITEMS = ["pre-commit", "post-commit", "pre-push"] as const;

function buildHookInstallAction(item: string): ReconcileAction {
	return {
		action: "install",
		item,
		type: "hooks",
		provider: "codex",
		global: false,
		targetPath: `/tmp/ck-e2e-test/.codex/hooks/${item}`,
		reason: "Provider directory is empty — reinstalling",
		reasonCode: "target-dir-empty-reinstall",
		reasonCopy: "Provider directory is empty — reinstalling",
		isDirectoryItem: false,
		sourceChecksum: `sha256-source-${item}`,
		registeredSourceChecksum: `sha256-source-${item}`,
		currentTargetChecksum: "unknown",
		registeredTargetChecksum: `sha256-target-${item}`,
	};
}

const MOCK_RECONCILE_PLAN: ReconcilePlan = {
	actions: HOOK_ITEMS.map(buildHookInstallAction),
	summary: { install: 3, update: 0, skip: 0, conflict: 0, delete: 0 },
	hasConflicts: false,
	banners: [
		{
			kind: "empty-dir",
			provider: "codex",
			type: "hooks",
			global: false,
			path: "/tmp/ck-e2e-test/.codex/hooks",
			itemCount: 3,
			// This message is rendered inside <strong> in MigratePageContent banner block.
			// The EmptyDirBanner component (in ReconcilePlanView) renders
			// t("migrateBanner_emptyDir_title") = "Detected empty directory".
			// Both appear in DOM — use the strong element for unique matching.
			message: "Detected empty ~/.codex/hooks/: 3 items will be reinstalled.",
		},
	],
};

const MOCK_DISCOVERY = {
	cwd: "/tmp/ck-e2e-test",
	targetPaths: {
		project: "/tmp/ck-e2e-test/.claude",
		global: "/tmp/ck-e2e-test/.claude",
	},
	sourcePaths: {
		agents: null,
		commands: null,
		skills: null,
		hooks: "/opt/claudekit/.codex/hooks",
		config: null,
		rules: null,
	},
	sourceOrigins: {
		agents: null,
		commands: null,
		skills: null,
		hooks: "kit",
		config: null,
		rules: null,
	},
	providers: MOCK_PROVIDERS,
	counts: { agents: 0, commands: 0, skills: 0, hooks: 3, config: 0, rules: 0 },
	installationCounts: { agents: 0, commands: 0, skills: 0, hooks: 3, config: 0, rules: 0 },
	collisions: [],
};

const MOCK_EXECUTE_RESULT = {
	results: HOOK_ITEMS.map((item) => ({
		item,
		type: "hooks",
		provider: "codex",
		success: true,
		skipped: false,
		path: `/tmp/ck-e2e-test/.codex/hooks/${item}`,
	})),
	counts: { installed: 3, updated: 0, skipped: 0, failed: 0, deleted: 0 },
	summary: { installed: 3, updated: 0, skipped: 0, failed: 0, deleted: 0 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setupMocks(page: import("@playwright/test").Page): Promise<void> {
	await page.route("**/api/migrate/providers", (route) =>
		route.fulfill({ json: { providers: MOCK_PROVIDERS } }),
	);
	await page.route("**/api/migrate/discovery**", (route) =>
		route.fulfill({ json: MOCK_DISCOVERY }),
	);
	await page.route("**/api/migrate/reconcile**", (route) =>
		route.fulfill({ json: { plan: MOCK_RECONCILE_PLAN, suggestedMode: "reconcile" } }),
	);
	await page.route("**/api/migrate/execute", (route) =>
		route.fulfill({ json: MOCK_EXECUTE_RESULT }),
	);
}

/**
 * Select the Codex provider and trigger reconcile.
 * Waits for the page heading then clicks Select + Run Migration.
 */
async function selectCodexAndRun(page: import("@playwright/test").Page): Promise<void> {
	// "Target Providers" heading is present in idle phase once providers load
	await expect(page.getByText("Target Providers")).toBeVisible({ timeout: 10_000 });

	// Click the Select button on the first (and only) provider card
	await page.getByRole("button", { name: "Select" }).first().click();

	// Run Migration button is in the right-side aside
	await page.getByRole("button", { name: "Run Migration" }).click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Scenario A — empty-dir reinstall banner", () => {
	test.beforeEach(async ({ page }) => {
		await setupMocks(page);
		await page.goto("/migrate");
		// Wait for the page title to confirm /migrate rendered (not a 404 or loading spinner)
		await expect(page.getByRole("heading", { name: "Migrate" })).toBeVisible({ timeout: 10_000 });
	});

	test("empty-dir banner appears with path text", async ({ page }) => {
		await selectCodexAndRun(page);

		// The banner message is rendered as <strong> inside the yellow MigratePageContent
		// banner block. It contains the path text from banner.message.
		// Use locator('strong') to avoid strict-mode collision with EmptyDirBanner's title.
		await expect(page.locator("strong").filter({ hasText: /Detected empty/ })).toBeVisible({
			timeout: 15_000,
		});
	});

	test("Install tab shows 3 hook items", async ({ page }) => {
		await selectCodexAndRun(page);

		// Wait for the plan review panel heading (confirms reconcile result rendered)
		await expect(page.getByText("Review Plan", { exact: true })).toBeVisible({
			timeout: 15_000,
		});

		// Each item renders as a display name "<provider>/<item>" in a .font-mono span.
		// With only install actions, ReconcilePlanView renders items directly (no tab strip).
		for (const hookItem of HOOK_ITEMS) {
			// Exact match on display name e.g. "codex/pre-commit"
			await expect(page.getByText(`codex/${hookItem}`, { exact: true })).toBeVisible({
				timeout: 10_000,
			});
		}
	});

	test("Skip tab is absent — all 3 hooks route to Install (0 skip actions)", async ({ page }) => {
		await selectCodexAndRun(page);

		// The mock plan summary is {install: 3, skip: 0}.
		// ReconcilePlanView only renders tabs for action types with ≥1 item.
		// There should be no Skip tab — only an Install tab.
		await expect(page.getByRole("tab", { name: /Install/i })).toBeVisible({ timeout: 15_000 });

		// Skip tab should NOT be present (0 skip actions in mock plan)
		await expect(page.getByRole("tab", { name: /Skip/i })).not.toBeVisible();
	});

	test("executing the plan shows Installed: 3 in success summary", async ({ page }) => {
		await selectCodexAndRun(page);

		// Wait for Execute Migration button
		const execButton = page.getByRole("button", { name: "Execute Migration" });
		await expect(execButton).toBeVisible({ timeout: 15_000 });
		await execButton.click();

		// After execution, the summary panel shows "Installed" label with count 3.
		// SummaryStat renders the count as <p class="... text-green-400">3</p>.
		// Scope to .text-green-400 <p> elements to avoid matching badge spans.
		await expect(page.getByText("Installed").first()).toBeVisible({ timeout: 15_000 });
		await expect(page.locator("p.text-green-400").filter({ hasText: "3" }).first()).toBeVisible({
			timeout: 10_000,
		});
	});
});
