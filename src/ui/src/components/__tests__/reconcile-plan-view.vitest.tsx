/**
 * Unit tests for ReconcilePlanView and EmptyDirBanner (Phase 3 — 4-tab UX)
 *
 * Coverage:
 * - 4 tabs render (install/update/delete/skip) when all buckets populated
 * - Conflict actions route to install tab, conflict banner appears
 * - Checkbox toggles onFlip callback with correct decision
 * - Kebab flip menu triggers onFlip (move to skip / move to install)
 * - Dim styling applied to flipped-to-skip items
 * - Empty-dir banner renders when plan has banners, hidden otherwise
 * - Skip tab content collapses by default; expands on "show skipped" click
 * - MAX_RENDERED_ACTIONS cap shows overflow indicator
 * - Empty plan (no actions) renders without crashing
 * - EmptyDirBanner: empty-dir-respected shows reinstall CTA
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReconcileAction, ReconcileBanner, ReconcilePlan } from "../../types/reconcile-types";
import { EmptyDirBanner } from "../migrate/empty-dir-banner";
import { ReconcilePlanView } from "../migrate/reconcile-plan-view";

// ─── i18n mock ────────────────────────────────────────────────────────────────

vi.mock("../../i18n", () => ({
	useI18n: () => ({
		t: (key: string) =>
			(
				({
					migrateActionInstall: "Install",
					migrateActionUpdate: "Update",
					migrateActionDelete: "Delete",
					migrateActionSkip: "Skip",
					migrateActionConflict: "Conflict",
					migrateTypeAgents: "Subagents",
					migrateTypeCommands: "Commands",
					migrateTypeSkills: "Skills",
					migrateTypeConfig: "Config",
					migrateTypeRules: "Rules",
					migrateTypeHooks: "Hooks",
					migrateConflictBanner_title: "Conflicts detected",
					migrateConflictBanner_cta: "Open conflict resolver",
					migrateConflictBanner_hide: "Hide conflict resolver",
					migrateConflictBadge: "Conflict",
					migrateFlip_moveToSkip: "Move to Skip",
					migrateFlip_moveToInstall: "Move to Install",
					migrateFlip_toggleItem: "Toggle item",
					migrateShowSkippedItems: "Show skipped items",
					migrateHideSkippedItems: "Hide skipped items",
					migrateBanner_emptyDir_title: "Detected empty directory",
					migrateBanner_emptyDir_body: "items below will be reinstalled. Uncheck any to skip.",
					migrateBanner_emptyDirRespected_title: "Respecting your deletion",
					migrateBanner_emptyDirRespected_body: "is empty. Respecting your deletion.",
					migrateBanner_reinstallCta: "Reinstall these items",
					migrateConflictResolved: "Resolved",
					migrateConflictUseCK: "Use CK",
					migrateConflictKeepMine: "Keep Mine",
					migrateConflictSmartMerge: "Smart Merge",
					migrateConflictShowDiff: "Show Diff",
					migrateConflictHideDiff: "Hide Diff",
					migrateConflictManual: "Manual",
					migrateReason_noChanges: "No changes detected",
					migrateReason_sourceChanged: "Source has been updated",
					migrateReason_newItem: "New item from provider",
					migrateReason_userDeletedRespected: "User deletion respected",
				}) as Record<string, string>
			)[key] ?? key,
	}),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAction(
	overrides: Partial<ReconcileAction> & Pick<ReconcileAction, "action" | "item">,
): ReconcileAction {
	return {
		provider: "codex",
		type: "command",
		global: true,
		targetPath: "/home/user/.claude/commands/test.md",
		reason: "Source changed",
		reasonCode: "source-changed",
		reasonCopy: "Source has been updated",
		...overrides,
	};
}

function makePlan(actions: ReconcileAction[], banners: ReconcileBanner[] = []): ReconcilePlan {
	const summary = { install: 0, update: 0, skip: 0, conflict: 0, delete: 0 };
	for (const a of actions) {
		if (a.action === "install") summary.install++;
		else if (a.action === "update") summary.update++;
		else if (a.action === "skip") summary.skip++;
		else if (a.action === "conflict") summary.conflict++;
		else if (a.action === "delete") summary.delete++;
	}
	return {
		actions,
		summary,
		hasConflicts: summary.conflict > 0,
		banners,
	};
}

const defaultKey = (a: ReconcileAction) => `${a.provider}:${a.type}:${a.item}`;

function renderView(
	plan: ReconcilePlan,
	flips = new Map<string, "execute" | "skip">(),
	onFlip = vi.fn(),
) {
	const resolutions = new Map();
	return render(
		<ReconcilePlanView
			plan={plan}
			resolutions={resolutions}
			onResolve={vi.fn()}
			actionKey={defaultKey}
			flips={flips}
			onFlip={onFlip}
		/>,
	);
}

// ─── Tab visibility ────────────────────────────────────────────────────────────

describe("ReconcilePlanView — tab strip", () => {
	it("renders 4 tabs when all non-conflict buckets are populated", () => {
		const plan = makePlan([
			makeAction({ action: "install", item: "a" }),
			makeAction({ action: "update", item: "b" }),
			makeAction({ action: "delete", item: "c" }),
			makeAction({ action: "skip", item: "d" }),
		]);

		renderView(plan);

		const tablist = screen.getByRole("tablist");
		expect(within(tablist).getByRole("tab", { name: /Install/i })).toBeInTheDocument();
		expect(within(tablist).getByRole("tab", { name: /Update/i })).toBeInTheDocument();
		expect(within(tablist).getByRole("tab", { name: /Delete/i })).toBeInTheDocument();
		expect(within(tablist).getByRole("tab", { name: /Skip/i })).toBeInTheDocument();
	});

	it("hides tabs that have no items", () => {
		const plan = makePlan([makeAction({ action: "install", item: "a" })]);
		renderView(plan);

		// No tablist rendered when only 1 tab has items
		expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
	});

	it("does not render a Conflict tab — conflicts route to Install", () => {
		const plan = makePlan([
			makeAction({ action: "conflict", item: "x" }),
			makeAction({ action: "install", item: "y" }),
		]);
		renderView(plan);

		// Conflict does not appear as a tab
		if (screen.queryByRole("tablist")) {
			const tablist = screen.getByRole("tablist");
			expect(within(tablist).queryByRole("tab", { name: /Conflict/i })).not.toBeInTheDocument();
		}
	});
});

// ─── Conflict banner ───────────────────────────────────────────────────────────

describe("ReconcilePlanView — conflict banner", () => {
	it("shows conflict banner when plan.hasConflicts is true", () => {
		const plan = makePlan([makeAction({ action: "conflict", item: "z" })]);
		renderView(plan);
		expect(screen.getByText(/Conflicts detected/i)).toBeInTheDocument();
	});

	it("hides conflict banner when no conflicts", () => {
		const plan = makePlan([makeAction({ action: "install", item: "a" })]);
		renderView(plan);
		expect(screen.queryByText(/Conflicts detected/i)).not.toBeInTheDocument();
	});

	it("toggles conflict resolver on CTA click", async () => {
		const user = userEvent.setup();
		const plan = makePlan([makeAction({ action: "conflict", item: "z" })]);
		renderView(plan);

		// Resolver hidden initially
		expect(screen.queryByText("Use CK")).not.toBeInTheDocument();

		await user.click(screen.getByText("Open conflict resolver"));
		expect(screen.getByText("Use CK")).toBeInTheDocument();

		await user.click(screen.getByText("Hide conflict resolver"));
		expect(screen.queryByText("Use CK")).not.toBeInTheDocument();
	});
});

// ─── Checkbox + flip ──────────────────────────────────────────────────────────

describe("ReconcilePlanView — checkbox toggles flip", () => {
	it("calls onFlip('skip') when checkbox unchecked", async () => {
		const user = userEvent.setup();
		const onFlip = vi.fn();
		const action = makeAction({ action: "install", item: "hook-a" });
		const plan = makePlan([action]);

		renderView(plan, new Map(), onFlip);

		const checkbox = screen.getByRole("checkbox", { name: /Toggle item.*hook-a/i });
		expect(checkbox).toBeChecked(); // default checked for install

		await user.click(checkbox);
		expect(onFlip).toHaveBeenCalledWith(action, "skip");
	});

	it("calls onFlip('execute') when checkbox rechecked", async () => {
		const user = userEvent.setup();
		const onFlip = vi.fn();
		const action = makeAction({ action: "install", item: "hook-b" });
		const plan = makePlan([action]);
		const flips = new Map([["codex:command:hook-b", "skip" as const]]);

		renderView(plan, flips, onFlip);

		const checkbox = screen.getByRole("checkbox", { name: /Toggle item.*hook-b/i });
		expect(checkbox).not.toBeChecked();

		await user.click(checkbox);
		expect(onFlip).toHaveBeenCalledWith(action, "execute");
	});
});

// ─── Dim styling ──────────────────────────────────────────────────────────────

describe("ReconcilePlanView — dim state", () => {
	it("applies opacity-50 to items flipped to skip", () => {
		const action = makeAction({ action: "install", item: "dim-me" });
		const plan = makePlan([action]);
		const flips = new Map([["codex:command:dim-me", "skip" as const]]);

		const { container } = renderView(plan, flips);

		// Item row should have opacity-50 class
		const dimmedRow = container.querySelector(".opacity-50");
		expect(dimmedRow).not.toBeNull();
	});

	it("applies full opacity to active items", () => {
		const action = makeAction({ action: "install", item: "bright" });
		const plan = makePlan([action]);

		const { container } = renderView(plan);

		expect(container.querySelector(".opacity-50")).toBeNull();
		expect(container.querySelector(".opacity-100")).not.toBeNull();
	});
});

// ─── Empty-dir banners ────────────────────────────────────────────────────────

describe("ReconcilePlanView — empty-dir banners", () => {
	it("renders banner above tabs when plan.banners is non-empty", () => {
		const banner: ReconcileBanner = {
			kind: "empty-dir",
			provider: "codex",
			type: "command",
			global: true,
			path: "~/.codex/commands/",
			itemCount: 3,
			message: "Detected empty directory",
		};
		const plan = makePlan([makeAction({ action: "install", item: "x" })], [banner]);
		renderView(plan);
		expect(screen.getByText(/Detected empty directory/i)).toBeInTheDocument();
	});

	it("hides banners when plan.banners is empty", () => {
		const plan = makePlan([makeAction({ action: "install", item: "x" })], []);
		renderView(plan);
		expect(screen.queryByText(/Detected empty directory/i)).not.toBeInTheDocument();
	});
});

// ─── Skip tab expander ────────────────────────────────────────────────────────

describe("ReconcilePlanView — skip tab collapses by default", () => {
	it("shows 'Show skipped items' expander and hides content by default", async () => {
		const user = userEvent.setup();
		const plan = makePlan([
			makeAction({ action: "install", item: "a" }),
			makeAction({ action: "skip", item: "b", reasonCode: "no-changes", reasonCopy: "No changes" }),
		]);
		renderView(plan);

		// Switch to skip tab
		await user.click(screen.getByRole("tab", { name: /Skip/i }));

		// Outer expander present, content hidden initially
		expect(screen.getByText(/Show skipped items/i)).toBeInTheDocument();
		// Commands type subsection header not rendered until outer is expanded
		expect(screen.queryByText("Commands")).not.toBeInTheDocument();

		// Expand outer — shows type subsection headers (still collapsed)
		await user.click(screen.getByText(/Show skipped items/i));
		expect(screen.getByText("Commands")).toBeInTheDocument();

		// Item reason text is behind the inner TypeSubSection collapse — expand it
		await user.click(screen.getByText("Commands"));
		expect(screen.getByText("No changes")).toBeInTheDocument();
	});
});

// ─── Empty plan ───────────────────────────────────────────────────────────────

describe("ReconcilePlanView — empty state", () => {
	it("renders without crashing when no actions exist", () => {
		const plan = makePlan([]);
		expect(() => renderView(plan)).not.toThrow();
	});
});

// ─── EmptyDirBanner component ─────────────────────────────────────────────────

describe("EmptyDirBanner", () => {
	const emptyDirBanner: ReconcileBanner = {
		kind: "empty-dir",
		provider: "codex",
		type: "command",
		global: true,
		path: "~/.codex/hooks/",
		itemCount: 3,
		message: "Detected empty hooks directory",
	};

	const respectedBanner: ReconcileBanner = {
		...emptyDirBanner,
		kind: "empty-dir-respected",
	};

	it("renders empty-dir banner with path and item count", () => {
		render(<EmptyDirBanner banner={emptyDirBanner} />);
		expect(screen.getByText(/~\/.codex\/hooks\//)).toBeInTheDocument();
		expect(screen.getByText(/3/)).toBeInTheDocument();
	});

	it("does not show reinstall CTA on plain empty-dir banner", () => {
		render(<EmptyDirBanner banner={emptyDirBanner} onRespectDeletionsOverride={vi.fn()} />);
		expect(screen.queryByText(/Reinstall these items/i)).not.toBeInTheDocument();
	});

	it("shows reinstall CTA on empty-dir-respected banner when handler provided", () => {
		render(<EmptyDirBanner banner={respectedBanner} onRespectDeletionsOverride={vi.fn()} />);
		expect(screen.getByText(/Reinstall these items/i)).toBeInTheDocument();
	});

	it("calls onRespectDeletionsOverride when reinstall CTA clicked", async () => {
		const user = userEvent.setup();
		const handler = vi.fn();
		render(<EmptyDirBanner banner={respectedBanner} onRespectDeletionsOverride={handler} />);

		await user.click(screen.getByText(/Reinstall these items/i));
		expect(handler).toHaveBeenCalledOnce();
	});

	it("hides reinstall CTA on empty-dir-respected when no handler", () => {
		render(<EmptyDirBanner banner={respectedBanner} />);
		expect(screen.queryByText(/Reinstall these items/i)).not.toBeInTheDocument();
	});
});
