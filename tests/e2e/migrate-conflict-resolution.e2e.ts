/**
 * Conflict-resolution regression for the dashboard migrate flow.
 *
 * Reported path: Run Migration -> resolve conflict with Use CK -> no obvious
 * next action. The sticky sidebar should become the executable CTA and submit
 * the resolution payload to /api/migrate/execute.
 */

import { expect, test } from "@playwright/test";
import type { ReconcileAction, ReconcilePlan } from "../../src/ui/src/types/reconcile-types.js";

const CONFLICT_ACTION: ReconcileAction = {
	action: "conflict",
	item: "pre-commit",
	type: "hooks",
	provider: "codex",
	global: true,
	targetPath: "/tmp/ck-e2e-test/.codex/hooks/pre-commit",
	reason: "Both CK and user modified this item",
	reasonCode: "both-changed",
	reasonCopy: "Both CK and user modified this item",
	isDirectoryItem: false,
	sourceChecksum: "sha256-source-new",
	registeredSourceChecksum: "sha256-source-old",
	currentTargetChecksum: "sha256-target-user",
	registeredTargetChecksum: "sha256-target-old",
	diff: "- old\n+ new",
};

const UPDATE_ACTION: ReconcileAction = {
	action: "update",
	item: "post-commit",
	type: "hooks",
	provider: "codex",
	global: true,
	targetPath: "/tmp/ck-e2e-test/.codex/hooks/post-commit",
	reason: "Source changed",
	reasonCode: "source-changed",
	reasonCopy: "Source changed",
	isDirectoryItem: false,
	sourceChecksum: "sha256-post-source-new",
	registeredSourceChecksum: "sha256-post-source-old",
	currentTargetChecksum: "sha256-post-target-old",
	registeredTargetChecksum: "sha256-post-target-old",
};

const SKIP_ACTION: ReconcileAction = {
	action: "skip",
	item: "pre-push",
	type: "hooks",
	provider: "codex",
	global: true,
	targetPath: "/tmp/ck-e2e-test/.codex/hooks/pre-push",
	reason: "User edits preserved",
	reasonCode: "user-edits-preserved",
	reasonCopy: "User edits preserved",
	isDirectoryItem: false,
	sourceChecksum: "sha256-pre-push-source",
	registeredSourceChecksum: "sha256-pre-push-source",
	currentTargetChecksum: "sha256-pre-push-user",
	registeredTargetChecksum: "sha256-pre-push-original",
};

const MOCK_RECONCILE_PLAN: ReconcilePlan = {
	actions: [CONFLICT_ACTION],
	summary: { install: 0, update: 0, skip: 0, conflict: 1, delete: 0 },
	hasConflicts: true,
	banners: [],
};

const MOCK_FLIP_PLAN: ReconcilePlan = {
	actions: [CONFLICT_ACTION, UPDATE_ACTION, SKIP_ACTION],
	summary: { install: 0, update: 1, skip: 1, conflict: 1, delete: 0 },
	hasConflicts: true,
	banners: [],
};

const MOCK_UPDATE_ONLY_PLAN: ReconcilePlan = {
	actions: [UPDATE_ACTION],
	summary: { install: 0, update: 1, skip: 0, conflict: 0, delete: 0 },
	hasConflicts: false,
	banners: [],
};

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
	counts: { agents: 0, commands: 0, skills: 0, hooks: 1, config: 0, rules: 0 },
	installationCounts: { agents: 0, commands: 0, skills: 0, hooks: 1, config: 0, rules: 0 },
	collisions: [],
};

const MOCK_EXECUTE_RESULT = {
	results: [
		{
			item: "pre-commit",
			type: "hooks",
			provider: "codex",
			success: true,
			skipped: false,
			path: "/tmp/ck-e2e-test/.codex/hooks/pre-commit",
		},
	],
	counts: { installed: 0, updated: 1, skipped: 0, failed: 0, deleted: 0 },
	summary: { installed: 0, updated: 1, skipped: 0, failed: 0, deleted: 0 },
};

async function setupRoutes(
	page: import("@playwright/test").Page,
	plan: ReconcilePlan,
	executePayloads: unknown[],
): Promise<{ getReconcileCalls: () => number }> {
	let reconcileCalls = 0;

	await page.route("**/api/migrate/providers", (route) =>
		route.fulfill({ json: { providers: MOCK_PROVIDERS } }),
	);
	await page.route("**/api/migrate/discovery**", (route) =>
		route.fulfill({ json: MOCK_DISCOVERY }),
	);
	await page.route("**/api/migrate/reconcile**", (route) => {
		reconcileCalls += 1;
		return route.fulfill({
			json: { plan, suggestedMode: "reconcile" },
		});
	});
	await page.route("**/api/migrate/execute", async (route) => {
		executePayloads.push(route.request().postDataJSON());
		return route.fulfill({ json: MOCK_EXECUTE_RESULT });
	});

	return { getReconcileCalls: () => reconcileCalls };
}

async function openMigratePlan(page: import("@playwright/test").Page): Promise<void> {
	await page.goto("/migrate");
	await expect(page.getByRole("heading", { name: "Migrate" })).toBeVisible({
		timeout: 10_000,
	});

	await page.getByRole("button", { name: "Select" }).first().click();
	await page.getByRole("button", { name: "Run Migration" }).click();
}

test.describe("Migrate conflict resolution", () => {
	test("Use CK enables sticky execute CTA and posts the resolution payload", async ({ page }) => {
		const executePayloads: unknown[] = [];
		const routes = await setupRoutes(page, MOCK_RECONCILE_PLAN, executePayloads);
		await openMigratePlan(page);

		const sidebar = page.locator("aside");
		const sidebarExecute = sidebar.getByRole("button", { name: "Execute Migration" });
		await expect(sidebarExecute).toBeVisible({ timeout: 10_000 });
		await expect(sidebarExecute).toBeDisabled();
		await expect(sidebar.getByText("Resolve all conflicts before executing")).toBeVisible();

		await page.getByRole("button", { name: "Open conflict resolver" }).click();
		await page.getByRole("button", { name: "Use CK" }).click();

		await expect(sidebarExecute).toBeEnabled();

		await page.locator("#migrate-install-tab").click();
		await expect(page.getByText(/Switch mode/i)).toBeVisible();
		await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

		await sidebarExecute.click();

		await expect(page.getByText("Migration Complete", { exact: true })).toBeVisible({
			timeout: 10_000,
		});
		expect(routes.getReconcileCalls()).toBe(1);
		expect(executePayloads).toHaveLength(1);

		const payload = executePayloads[0] as {
			plan: ReconcilePlan;
			resolutions: Record<string, { type: string }>;
		};
		const resolutionKey = JSON.stringify(["codex", "hooks", "pre-commit", true]);
		expect(payload.plan.actions[0]?.action).toBe("conflict");
		expect(payload.resolutions[resolutionKey]).toEqual({ type: "overwrite" });
	});

	test("row execute and skip decisions are applied to the execute payload", async ({ page }) => {
		const executePayloads: unknown[] = [];
		await setupRoutes(page, MOCK_FLIP_PLAN, executePayloads);
		await openMigratePlan(page);

		const sidebarExecute = page.locator("aside").getByRole("button", {
			name: "Execute Migration",
		});
		await expect(sidebarExecute).toBeDisabled({ timeout: 10_000 });

		await page.getByRole("tab", { name: /Update/i }).click();
		await page.getByRole("checkbox", { name: /Toggle item.*post-commit/i }).click();

		await page.getByRole("tab", { name: /Install 1 items/i }).click();
		await page.getByRole("checkbox", { name: /Toggle item.*pre-commit/i }).click();
		await page.getByRole("tab", { name: /Skip/i }).click();
		await page.getByText(/Show skipped items/i).click();
		await page
			.getByRole("button", { name: /Hooks/i })
			.filter({ has: page.locator("h4") })
			.click();
		await page.getByRole("button", { name: "More actions" }).first().click();
		await page.getByText("Move to Install").click();

		await expect(sidebarExecute).toBeEnabled();
		await sidebarExecute.click();

		expect(executePayloads).toHaveLength(1);
		const payload = executePayloads[0] as { plan: ReconcilePlan };
		const actionsByItem = new Map(
			payload.plan.actions.map((action) => [action.item, action.action]),
		);

		expect(actionsByItem.get("pre-commit")).toBe("skip");
		expect(actionsByItem.get("pre-push")).toBe("install");
		expect(actionsByItem.get("post-commit")).toBe("skip");
		expect(payload.plan.summary).toEqual({
			install: 1,
			update: 0,
			skip: 2,
			conflict: 0,
			delete: 0,
		});
		expect(payload.plan.hasConflicts).toBe(false);
	});

	test("toggling a row back to its original state clears dirty mode-switch state", async ({
		page,
	}) => {
		const executePayloads: unknown[] = [];
		await setupRoutes(page, MOCK_UPDATE_ONLY_PLAN, executePayloads);
		await openMigratePlan(page);

		const checkbox = page.getByRole("checkbox", { name: /Toggle item.*post-commit/i });
		await checkbox.click();
		await expect(checkbox).not.toBeChecked();
		await checkbox.click();
		await expect(checkbox).toBeChecked();

		await page.locator("#migrate-install-tab").click();
		await expect(page.getByText(/Switch mode/i)).toBeHidden();
		expect(executePayloads).toHaveLength(0);
	});

	test("cancel clears skipped conflict decisions before the next reconcile", async ({ page }) => {
		const executePayloads: unknown[] = [];
		const routes = await setupRoutes(page, MOCK_FLIP_PLAN, executePayloads);
		await openMigratePlan(page);

		const sidebar = page.locator("aside");
		const sidebarExecute = sidebar.getByRole("button", { name: "Execute Migration" });
		await expect(sidebarExecute).toBeDisabled({ timeout: 10_000 });

		await page.getByRole("checkbox", { name: /Toggle item.*pre-commit/i }).click();
		await expect(sidebarExecute).toBeEnabled();

		await page.getByRole("button", { name: "Cancel" }).first().click();
		await page.getByRole("button", { name: "Run Migration" }).click();

		await expect(sidebarExecute).toBeDisabled({ timeout: 10_000 });
		await expect(sidebar.getByText("Resolve all conflicts before executing")).toBeVisible();
		expect(routes.getReconcileCalls()).toBe(2);
		expect(executePayloads).toHaveLength(0);
	});
});
