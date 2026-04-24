/**
 * Scenario B — 4-tab routing correctness
 *
 * Verifies that the ReconcilePlanView routes actions into the correct tabs
 * (Install, Update, Delete, Skip) based on their reasonCode, and that the
 * per-item kebab flip menu moves items between tabs.
 *
 * Mock plan contains:
 *   - 1 command → Update (reasonCode: "source-changed")
 *   - 1 agent → Delete  (reasonCode: "source-removed-orphan")
 *   - 1 hook  → Skip    (reasonCode: "user-edits-preserved")
 *   - 1 hook  → Install (reasonCode: "new-item", simulates a new hook discovered)
 *
 * No conflicts in this scenario — verifies conflict banner is absent.
 *
 * Tab strip renders only tabs that have ≥1 item, so all 4 tabs appear.
 * Skip tab is collapsed by default; click expander to see items.
 *
 * Flip test: Delete → kebab → "Move to Skip" → item disappears from Delete tab.
 */

import { expect, test } from "@playwright/test";
import type { ReconcileAction, ReconcilePlan } from "../../src/ui/src/types/reconcile-types.js";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PROVIDERS = [
	{
		name: "claude",
		displayName: "Claude",
		detected: true,
		recommended: true,
		commandsGlobalOnly: false,
		capabilities: {
			agents: true,
			commands: true,
			skills: false,
			config: false,
			rules: false,
			hooks: false,
		},
	},
	{
		name: "codex",
		displayName: "Codex",
		detected: true,
		recommended: false,
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

const MOCK_DISCOVERY = {
	cwd: "/tmp/ck-e2e-test",
	targetPaths: {
		project: "/tmp/ck-e2e-test/.claude",
		global: "/tmp/ck-e2e-test/.claude",
	},
	sourcePaths: {
		agents: "/opt/claudekit/.claude/agents",
		commands: "/opt/claudekit/.claude/commands",
		skills: null,
		hooks: "/opt/claudekit/.codex/hooks",
		config: null,
		rules: null,
	},
	sourceOrigins: {
		agents: "kit",
		commands: "kit",
		skills: null,
		hooks: "kit",
		config: null,
		rules: null,
	},
	providers: MOCK_PROVIDERS,
	counts: { agents: 1, commands: 1, skills: 0, hooks: 2, config: 0, rules: 0 },
	installationCounts: { agents: 1, commands: 1, skills: 0, hooks: 2, config: 0, rules: 0 },
	collisions: [],
};

/** Command routed to Update tab */
const UPDATE_ACTION: ReconcileAction = {
	action: "update",
	item: "build",
	type: "command",
	provider: "claude",
	global: false,
	targetPath: "/tmp/ck-e2e-test/.claude/commands/build.md",
	reason: "CK updated, you didn't edit — safe to overwrite",
	reasonCode: "source-changed",
	reasonCopy: "CK updated, you didn't edit — safe to overwrite",
	isDirectoryItem: false,
	sourceChecksum: "sha256-source-build-new",
	registeredSourceChecksum: "sha256-source-build-old",
	currentTargetChecksum: "sha256-target-build",
	registeredTargetChecksum: "sha256-target-build",
};

/** Agent routed to Delete tab (orphan — source removed) */
const DELETE_ACTION: ReconcileAction = {
	action: "delete",
	item: "deprecated-agent",
	type: "agent",
	provider: "claude",
	global: false,
	targetPath: "/tmp/ck-e2e-test/.claude/agents/deprecated-agent.md",
	reason: "Source removed — cleaning up orphan",
	reasonCode: "source-removed-orphan",
	reasonCopy: "Source removed — cleaning up orphan",
	isDirectoryItem: false,
	sourceChecksum: "unknown",
	registeredSourceChecksum: "sha256-source-deprecated-agent",
	currentTargetChecksum: "sha256-target-deprecated-agent",
	registeredTargetChecksum: "sha256-target-deprecated-agent",
};

/** Hook routed to Skip tab (user-edits-preserved) */
const SKIP_ACTION: ReconcileAction = {
	action: "skip",
	item: "pre-commit",
	type: "hooks",
	provider: "codex",
	global: false,
	targetPath: "/tmp/ck-e2e-test/.codex/hooks/pre-commit",
	reason: "User edits preserved",
	reasonCode: "user-edits-preserved",
	reasonCopy: "User edits preserved",
	isDirectoryItem: false,
	sourceChecksum: "sha256-source-pre-commit",
	registeredSourceChecksum: "sha256-source-pre-commit",
	// Target checksum differs from registered → user-edited
	currentTargetChecksum: "sha256-target-pre-commit-user-edited",
	registeredTargetChecksum: "sha256-target-pre-commit-original",
};

/** New hook routed to Install tab */
const INSTALL_ACTION: ReconcileAction = {
	action: "install",
	item: "post-commit",
	type: "hooks",
	provider: "codex",
	global: false,
	targetPath: "/tmp/ck-e2e-test/.codex/hooks/post-commit",
	reason: "New — not previously installed",
	reasonCode: "new-item",
	reasonCopy: "New — not previously installed",
	isDirectoryItem: false,
	sourceChecksum: "sha256-source-post-commit",
	registeredSourceChecksum: "unknown",
	currentTargetChecksum: "unknown",
	registeredTargetChecksum: "unknown",
};

const MOCK_RECONCILE_PLAN: ReconcilePlan = {
	actions: [INSTALL_ACTION, UPDATE_ACTION, DELETE_ACTION, SKIP_ACTION],
	summary: { install: 1, update: 1, skip: 1, conflict: 0, delete: 1 },
	hasConflicts: false,
	banners: [], // No banners in scenario B
};

const MOCK_EXECUTE_RESULT = {
	results: [
		{
			item: "post-commit",
			type: "hooks",
			provider: "codex",
			success: true,
			skipped: false,
			path: "/tmp/ck-e2e-test/.codex/hooks/post-commit",
		},
		{
			item: "build",
			type: "command",
			provider: "claude",
			success: true,
			skipped: false,
			path: "/tmp/ck-e2e-test/.claude/commands/build.md",
		},
		{
			item: "deprecated-agent",
			type: "agent",
			provider: "claude",
			success: true,
			skipped: false,
			path: "",
		},
		{
			item: "pre-commit",
			type: "hooks",
			provider: "codex",
			success: false,
			skipped: true,
			path: "",
		},
	],
	counts: { installed: 2, updated: 1, skipped: 1, failed: 0, deleted: 1 },
	summary: { installed: 2, updated: 1, skipped: 1, failed: 0, deleted: 1 },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

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

/** Select both providers and run reconcile */
async function selectProvidersAndRun(page: import("@playwright/test").Page): Promise<void> {
	// Wait for provider list to render before clicking
	await expect(page.getByText("Target Providers")).toBeVisible({ timeout: 10_000 });

	// Click first "Select" button (Claude). After it's clicked the button label changes to
	// "Selected", so the NEXT "Select" button in the DOM is now the Codex one — always
	// click `.first()` to get the next unselected provider.
	await page.getByRole("button", { name: "Select" }).first().click();
	await page.getByRole("button", { name: "Select" }).first().click();

	await page.getByRole("button", { name: "Run Migration" }).click();
}

/** Wait for the 4-tab strip to fully render.
 *
 * ReconcilePlanView tabs have accessible names like "Install 1 items", "Update 1 items" etc.
 * ModeToggle tabs have names like "Install Pick items to install" / "Reconcile …".
 * Use "/Install \d+ items/i" to target plan tabs specifically and avoid strict-mode collisions.
 */
async function waitForTabs(page: import("@playwright/test").Page): Promise<void> {
	await expect(page.getByRole("tab", { name: /Install \d+ items/i })).toBeVisible({
		timeout: 15_000,
	});
	await expect(page.getByRole("tab", { name: /Update/i })).toBeVisible();
	await expect(page.getByRole("tab", { name: /Delete/i })).toBeVisible();
	await expect(page.getByRole("tab", { name: /Skip/i })).toBeVisible();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Scenario B — 4-tab routing correctness", () => {
	test.beforeEach(async ({ page }) => {
		await setupMocks(page);
		await page.goto("/migrate");
		await expect(page.getByRole("heading", { name: "Migrate" })).toBeVisible({ timeout: 10_000 });
	});

	test("tab strip has exactly 4 tabs — Install, Update, Delete, Skip", async ({ page }) => {
		await selectProvidersAndRun(page);
		// waitForTabs already asserts Install, Update, Delete, Skip tabs are all visible
		await waitForTabs(page);

		// Verify there is no Conflict tab (no conflicts in mock plan)
		// ReconcilePlanView tab buttons include item count e.g. "Install 1 items"
		// Use exact getByRole tab to avoid matching ModeToggle's "Install Pick items to install"
		await expect(page.getByRole("tab", { name: /Conflict/i })).not.toBeVisible();
	});

	test("conflict banner is absent (no conflicts in this scenario)", async ({ page }) => {
		await selectProvidersAndRun(page);
		await waitForTabs(page);

		// Conflict banner text should not appear
		await expect(page.getByText("Conflicts detected")).not.toBeVisible();
	});

	test("Update tab contains command item with source-changed reason", async ({ page }) => {
		await selectProvidersAndRun(page);
		await waitForTabs(page);

		await page.getByRole("tab", { name: /Update/i }).click();

		// The command item "build" should appear in Update tab
		await expect(page.getByText("claude/build", { exact: false })).toBeVisible({ timeout: 10_000 });

		// The reason copy "CK updated" should appear
		await expect(page.getByText(/CK updated/i)).toBeVisible();
	});

	test("Delete tab contains orphan agent with source-removed-orphan reason", async ({ page }) => {
		await selectProvidersAndRun(page);
		await waitForTabs(page);

		await page.getByRole("tab", { name: /Delete/i }).click();

		// Items render as "<provider>/<item>" in a font-mono span.
		// Use exact display name to avoid strict-mode matching the path div.
		await expect(page.getByText("claude/deprecated-agent", { exact: true })).toBeVisible({
			timeout: 10_000,
		});

		// Reason copy for source-removed-orphan
		await expect(page.getByText(/Source removed/i)).toBeVisible();
	});

	test("Skip tab expander shows user-edits-preserved hook", async ({ page }) => {
		await selectProvidersAndRun(page);
		await waitForTabs(page);

		await page.getByRole("tab", { name: /Skip/i }).click();

		// Skip tab outer expander — "Show skipped items (N)"
		const showSkippedButton = page.getByText(/Show skipped items/i);
		await expect(showSkippedButton).toBeVisible({ timeout: 10_000 });
		await showSkippedButton.click();

		// TypeSubSection for "Hooks" renders collapsed by default inside skip content.
		// Click the section's toggle button (which contains the h4 "Hooks" heading) to expand.
		const hooksToggle = page.getByRole("button", { name: /Hooks/i }).filter({
			has: page.locator("h4"),
		});
		await expect(hooksToggle).toBeVisible({ timeout: 5_000 });
		await hooksToggle.click();

		// The user-edited hook should now be visible (display name "codex/pre-commit")
		await expect(page.getByText("codex/pre-commit", { exact: true })).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/User edits preserved/i)).toBeVisible();
	});

	test("Install tab contains new-item hook", async ({ page }) => {
		await selectProvidersAndRun(page);
		await waitForTabs(page);

		// Install tab is the default active tab (first non-empty tab in ACTION_TABS order).
		// post-commit hook renders as "codex/post-commit" display name.
		// Use exact match to avoid strict-mode collision with the path div.
		await expect(page.getByText("codex/post-commit", { exact: true })).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/New — not previously installed/i)).toBeVisible();
	});

	test("kebab flip: Delete item → Move to Skip → item no longer visible in Delete tab", async ({
		page,
	}) => {
		await selectProvidersAndRun(page);
		await waitForTabs(page);

		// Navigate to Delete tab
		await page.getByRole("tab", { name: /Delete/i }).click();

		// Verify the orphan agent is present using exact display name
		await expect(page.getByText("claude/deprecated-agent", { exact: true })).toBeVisible({
			timeout: 10_000,
		});

		// Open the kebab menu for this action item (aria-label="More actions").
		// ReconcilePlanView does not use role="tabpanel" — click the first "More actions"
		// button on page (only one exists on the Delete tab content).
		await page.getByRole("button", { name: "More actions" }).first().click();

		// Click "Move to Skip" in the dropdown
		await page.getByText("Move to Skip").click();

		// After flip, the action row checkbox should be unchecked.
		// aria-label on the checkbox is "Toggle item <provider>/<item>"
		const agentCheckbox = page.getByRole("checkbox", {
			name: /Toggle item.*deprecated-agent/i,
		});
		await expect(agentCheckbox).not.toBeChecked();
	});
});
