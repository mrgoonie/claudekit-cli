/**
 * Scenario C — Install mode picker end-to-end
 *
 * Simulates: fresh state (no registry) so suggestedMode="install".
 * Verifies the mode toggle defaults to Install, the picker shows type groups
 * with all items checked (decisions Q5), and executing with a partial selection
 * only installs the chosen items.
 *
 * Mock plan:
 *   install-discovery returns 2 agents + 2 commands (4 candidates total)
 *   All default-checked (decisions Q5)
 *
 * Test flow:
 *   1. /migrate loads → providers list
 *   2. Select claude provider, click Run Migration
 *   3. Reconcile returns suggestedMode="install" → mode toggle snaps to Install
 *   4. Install picker renders showing 4 candidates, all checked
 *   5. Uncheck 1 agent group (2 agents unchecked) → 2 commands remain selected
 *   6. Click "Install 2 selected items"
 *   7. Execute returns success for 2 items
 *   8. Navigate away and back → mode switches to Reconcile (registry now populated)
 *      (step 8 verified via mock: second reconcile call returns suggestedMode="reconcile")
 */

import { expect, test } from "@playwright/test";
import type { InstallCandidate } from "../../src/ui/src/types/reconcile-types.js";

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
		hooks: null,
		config: null,
		rules: null,
	},
	sourceOrigins: {
		agents: "kit",
		commands: "kit",
		skills: null,
		hooks: null,
		config: null,
		rules: null,
	},
	providers: MOCK_PROVIDERS,
	counts: { agents: 2, commands: 2, skills: 0, hooks: 0, config: 0, rules: 0 },
	installationCounts: { agents: 0, commands: 0, skills: 0, hooks: 0, config: 0, rules: 0 },
	collisions: [],
};

/** 4 install candidates: 2 agents + 2 commands, all not yet installed */
const MOCK_INSTALL_CANDIDATES: InstallCandidate[] = [
	{
		item: "code-reviewer",
		type: "agent",
		provider: "claude",
		global: false,
		isDirectoryItem: false,
		sourcePath: ".claude/agents/code-reviewer.md",
		alreadyInstalled: false,
		description: "Reviews code for quality and correctness",
	},
	{
		item: "researcher",
		type: "agent",
		provider: "claude",
		global: false,
		isDirectoryItem: false,
		sourcePath: ".claude/agents/researcher.md",
		alreadyInstalled: false,
		description: "Researches technical topics",
	},
	{
		item: "build",
		type: "command",
		provider: "claude",
		global: false,
		isDirectoryItem: false,
		sourcePath: ".claude/commands/build.md",
		alreadyInstalled: false,
		description: "Build command",
	},
	{
		item: "deploy",
		type: "command",
		provider: "claude",
		global: false,
		isDirectoryItem: false,
		sourcePath: ".claude/commands/deploy.md",
		alreadyInstalled: false,
		description: "Deploy command",
	},
];

/** Reconcile endpoint: fresh state → suggestedMode=install, empty plan */
const MOCK_RECONCILE_FRESH = {
	plan: {
		actions: [],
		summary: { install: 0, update: 0, skip: 0, conflict: 0, delete: 0 },
		hasConflicts: false,
		banners: [],
	},
	suggestedMode: "install",
};

/** Reconcile endpoint: after install → suggestedMode=reconcile (registry now populated) */
const MOCK_RECONCILE_AFTER_INSTALL = {
	plan: {
		actions: [],
		summary: { install: 0, update: 0, skip: 2, conflict: 0, delete: 0 },
		hasConflicts: false,
		banners: [],
	},
	suggestedMode: "reconcile",
};

const MOCK_INSTALL_DISCOVERY = {
	candidates: MOCK_INSTALL_CANDIDATES,
	typeDirectoryStates: [],
};

/** Execute result for 2 commands only (agents were deselected) */
const MOCK_EXECUTE_2_ITEMS = {
	results: [
		{
			item: "build",
			type: "command",
			provider: "claude",
			success: true,
			skipped: false,
			path: "/tmp/ck-e2e-test/.claude/commands/build.md",
		},
		{
			item: "deploy",
			type: "command",
			provider: "claude",
			success: true,
			skipped: false,
			path: "/tmp/ck-e2e-test/.claude/commands/deploy.md",
		},
	],
	counts: { installed: 2, updated: 0, skipped: 0, failed: 0, deleted: 0 },
	summary: { installed: 2, updated: 0, skipped: 0, failed: 0, deleted: 0 },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setupMocks(
	page: import("@playwright/test").Page,
	opts: { afterInstall?: boolean } = {},
): Promise<void> {
	await page.route("**/api/migrate/providers", (route) =>
		route.fulfill({ json: { providers: MOCK_PROVIDERS } }),
	);
	await page.route("**/api/migrate/discovery**", (route) =>
		route.fulfill({ json: MOCK_DISCOVERY }),
	);

	// Reconcile mock: returns suggestedMode=install on first call, reconcile on second
	let reconcileCallCount = 0;
	await page.route("**/api/migrate/reconcile**", (route) => {
		reconcileCallCount++;
		if (opts.afterInstall || reconcileCallCount > 1) {
			return route.fulfill({ json: MOCK_RECONCILE_AFTER_INSTALL });
		}
		return route.fulfill({ json: MOCK_RECONCILE_FRESH });
	});

	await page.route("**/api/migrate/install-discovery**", (route) =>
		route.fulfill({ json: MOCK_INSTALL_DISCOVERY }),
	);
	await page.route("**/api/migrate/execute", (route) =>
		route.fulfill({ json: MOCK_EXECUTE_2_ITEMS }),
	);
}

/**
 * Select claude provider and trigger the install picker.
 *
 * Three-step sequence required for the install picker to render:
 *
 *   Step 1: Click "Run Migration" (mode=reconcile) → reconcile endpoint returns
 *           suggestedMode="install" → smart-default useEffect switches mode to "install".
 *           Phase is now "reviewing" (empty plan). installCandidates is still null —
 *           neither the reconcile plan view nor the install picker renders. No Cancel button.
 *
 *   Step 2: Click "Reconcile" tab on ModeToggle → handleModeChange("reconcile") →
 *           migration.reset() → phase=idle, mode=reconcile. Run Migration re-enables.
 *           Then click "Install" tab → mode=install, phase=idle (reset() called again).
 *
 *   Step 3: Click "Run Migration" (mode=install) → fetchCandidates endpoint →
 *           installCandidates populated → picker renders.
 */
async function selectClaudeAndRun(page: import("@playwright/test").Page): Promise<void> {
	// Wait for provider list to render before clicking
	await expect(page.getByText("Target Providers")).toBeVisible({ timeout: 10_000 });

	await page.getByRole("button", { name: "Select" }).first().click();

	// Step 1: First run — reconcile → suggestedMode=install → mode switches to Install
	await page.getByRole("button", { name: "Run Migration" }).click();

	// Wait for the mode toggle to show Install as active (smart-default applied)
	await expect(page.locator("#migrate-install-tab")).toHaveAttribute("aria-selected", "true", {
		timeout: 15_000,
	});

	// Step 2: Click Reconcile tab (escapes limbo by calling reset → phase=idle)
	// Then click Install tab to switch mode back to install before running
	await page.locator("#migrate-reconcile-tab").click();
	await expect(page.getByRole("button", { name: "Run Migration" })).toBeEnabled({ timeout: 5_000 });
	await page.locator("#migrate-install-tab").click();

	// Step 3: Second run — mode=install → fetchCandidates → picker renders
	await page.getByRole("button", { name: "Run Migration" }).click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Scenario C — Install mode picker", () => {
	test.beforeEach(async ({ page }) => {
		await setupMocks(page);
		await page.goto("/migrate");
		await expect(page.getByRole("heading", { name: "Migrate" })).toBeVisible({ timeout: 10_000 });
	});

	test("mode toggle shows Install as active after fresh-registry reconcile", async ({ page }) => {
		await selectClaudeAndRun(page);

		// suggestedMode=install → MigratePage applies smart default via useEffect
		// ModeToggle renders two role="tab" buttons: Reconcile and Install
		// The Install tab should have aria-selected="true"
		// Wait for Install mode UI to appear (picker or mode toggle)
		// The ModeToggle renders when selectedProviders.length > 0 and phase is idle/reviewing
		await expect(page.getByRole("tab", { name: /Install/i }).first()).toBeVisible({
			timeout: 15_000,
		});

		// The mode toggle Install tab should be aria-selected=true
		// id="migrate-install-tab" is set in ModeToggle
		const modeInstallTab = page.locator("#migrate-install-tab");
		await expect(modeInstallTab).toHaveAttribute("aria-selected", "true", { timeout: 10_000 });
	});

	test("install picker renders type groups with all 4 items checked by default", async ({
		page,
	}) => {
		await selectClaudeAndRun(page);

		// Wait for the install picker to render
		// It shows when mode=install and installCandidates are loaded
		// The "Install {count} selected items" CTA confirms the picker is up
		await expect(page.getByText(/Install \d+ selected items/i)).toBeVisible({ timeout: 15_000 });

		// Agents group heading
		await expect(page.getByText("Agents").first()).toBeVisible();
		// Commands group heading
		await expect(page.getByText("Commands").first()).toBeVisible();

		// All 4 candidate checkboxes should be checked by default (decisions Q5)
		const checkboxes = page.getByRole("checkbox");
		const count = await checkboxes.count();
		expect(count).toBeGreaterThanOrEqual(4);

		// Verify each candidate is checked
		for (const item of ["code-reviewer", "researcher", "build", "deploy"]) {
			const checkbox = page.getByRole("checkbox", { name: new RegExp(item, "i") });
			await expect(checkbox).toBeChecked({ timeout: 5_000 });
		}
	});

	test("deselect agents group → CTA shows 2 selected items", async ({ page }) => {
		await selectClaudeAndRun(page);

		// Wait for picker
		await expect(page.getByText(/Install \d+ selected items/i)).toBeVisible({ timeout: 15_000 });

		// Click "Deselect all" for the Agents group
		// The TypeGroup header has "Deselect all" button
		// We target the Agents section's Deselect all button
		const agentsSection = page.locator(".border.border-dash-border.rounded-lg").filter({
			has: page.getByText("Agents").first(),
		});
		const deselectAllInAgents = agentsSection
			.getByRole("button", { name: /Deselect all/i })
			.first();
		await deselectAllInAgents.click();

		// CTA should now show "Install 2 selected items" (2 commands remain)
		await expect(page.getByText("Install 2 selected items")).toBeVisible({ timeout: 5_000 });
	});

	test("executing with 2 commands selected shows success for 2 items", async ({ page }) => {
		await selectClaudeAndRun(page);

		// Wait for picker
		await expect(page.getByText(/Install \d+ selected items/i)).toBeVisible({ timeout: 15_000 });

		// Deselect agents
		const agentsSection = page.locator(".border.border-dash-border.rounded-lg").filter({
			has: page.getByText("Agents").first(),
		});
		await agentsSection
			.getByRole("button", { name: /Deselect all/i })
			.first()
			.click();

		// Click install CTA
		await page.getByText("Install 2 selected items").click();

		// After execute, summary panel shows "Installed" with count 2.
		// SummaryStat renders the count as <p class="... text-green-400">2</p>.
		// Scope to <p> elements to avoid strict-mode matching badge spans.
		await expect(page.getByText("Installed").first()).toBeVisible({ timeout: 15_000 });
		await expect(page.locator("p.text-green-400").filter({ hasText: "2" }).first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("agent items NOT installed on disk (excluded from execute payload)", async ({ page }) => {
		// This test verifies the execute request body excludes deselected agents.
		// We capture the POST payload and assert it only contains command items.
		const executePayloads: unknown[] = [];

		await page.route("**/api/migrate/execute", async (route) => {
			const body = route.request().postDataJSON();
			executePayloads.push(body);
			await route.fulfill({ json: MOCK_EXECUTE_2_ITEMS });
		});

		await selectClaudeAndRun(page);
		await expect(page.getByText(/Install \d+ selected items/i)).toBeVisible({ timeout: 15_000 });

		// Deselect agents and execute
		const agentsSection = page.locator(".border.border-dash-border.rounded-lg").filter({
			has: page.getByText("Agents").first(),
		});
		await agentsSection
			.getByRole("button", { name: /Deselect all/i })
			.first()
			.click();
		await page.getByText("Install 2 selected items").click();

		// Wait for result
		await expect(page.getByText("Installed").first()).toBeVisible({ timeout: 15_000 });

		// Inspect captured payload
		expect(executePayloads).toHaveLength(1);
		const payload = executePayloads[0] as {
			plan: { actions: Array<{ item: string; type: string }> };
		};
		const installedItems = payload.plan.actions;

		// Only commands should appear — no agents
		const agentItems = installedItems.filter((a) => a.type === "agent");
		const commandItems = installedItems.filter((a) => a.type === "command");

		expect(agentItems).toHaveLength(0);
		expect(commandItems).toHaveLength(2);

		const commandNames = commandItems.map((a) => a.item);
		expect(commandNames).toContain("build");
		expect(commandNames).toContain("deploy");
	});

	test("navigate away and back → mode resets to Reconcile (registry now populated)", async ({
		page,
	}) => {
		await selectClaudeAndRun(page);
		await expect(page.getByText(/Install \d+ selected items/i)).toBeVisible({ timeout: 15_000 });

		// Execute install
		const agentsSection = page.locator(".border.border-dash-border.rounded-lg").filter({
			has: page.getByText("Agents").first(),
		});
		await agentsSection
			.getByRole("button", { name: /Deselect all/i })
			.first()
			.click();
		await page.getByText("Install 2 selected items").click();
		await expect(page.getByText("Installed").first()).toBeVisible({ timeout: 15_000 });

		// Navigate away (to dashboard) and back to /migrate
		await page.goto("/dashboard");
		await page.goto("/migrate");

		// On reload, reconcile is called again — this time mock returns suggestedMode=reconcile
		// Mode toggle should default to Reconcile
		await page.getByRole("button", { name: "Select" }).first().click();
		await page.getByRole("button", { name: "Run Migration" }).click();

		// Wait for mode toggle to appear
		const modeReconcileTab = page.locator("#migrate-reconcile-tab");
		await expect(modeReconcileTab).toBeVisible({ timeout: 15_000 });
		await expect(modeReconcileTab).toHaveAttribute("aria-selected", "true", { timeout: 10_000 });
	});
});
