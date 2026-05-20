/**
 * ReconcilePlanView — 4-tab reconcile review (Install / Update / Delete / Skip)
 *
 * Architecture:
 * - Conflicts surface as a collapsible banner above the tab strip (not a separate tab).
 * - Each action row has a checkbox (execute/skip decision) + kebab flip menu.
 * - Flips are kept by the parent (MigratePage) and passed down via props.
 * - Skip tab content collapses by default; expands on demand.
 * - Empty-dir banners are rendered by <EmptyDirBanner /> (separate component).
 */

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type TranslationKey, useI18n } from "../../i18n";
import type {
	ConflictResolution,
	ReconcileAction,
	ReconcileBanner,
	ReconcilePlan,
	ReconcileReason,
} from "../../types/reconcile-types";
import { ConflictResolver } from "./conflict-resolver";
import { EmptyDirBanner } from "./empty-dir-banner";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ReconcilePlanViewProps {
	plan: ReconcilePlan;
	resolutions: Map<string, ConflictResolution>;
	onResolve: (action: ReconcileAction, resolution: ConflictResolution) => void;
	actionKey: (action: ReconcileAction) => string;
	/** Caller-managed flip decisions: execute (checked) or skip (unchecked) per action key */
	flips: Map<string, "execute" | "skip">;
	onFlip: (action: ReconcileAction, decision: "execute" | "skip") => void;
	/** Called when user clicks "Reinstall these items" on an empty-dir-respected banner */
	onRespectDeletionsOverride?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** 4-tab layout — conflicts removed, handled via inline banner */
type ActionTabKey = "install" | "update" | "delete" | "skip";
type PortableType = ReconcileAction["type"];

interface ActionTabConfig {
	key: ActionTabKey;
	labelKey: TranslationKey;
	activeClass: string;
	badgeClass: string;
}

const ACTION_TABS: ActionTabConfig[] = [
	{
		key: "install",
		labelKey: "migrateActionInstall",
		activeClass: "border-green-400 text-green-400",
		badgeClass: "bg-green-500/10 border-green-500/30 text-green-400",
	},
	{
		key: "update",
		labelKey: "migrateActionUpdate",
		activeClass: "border-yellow-400 text-yellow-400",
		badgeClass: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
	},
	{
		key: "delete",
		labelKey: "migrateActionDelete",
		activeClass: "border-dash-text-secondary text-dash-text-secondary",
		badgeClass: "bg-dash-bg border-dash-border text-dash-text-secondary",
	},
	{
		key: "skip",
		labelKey: "migrateActionSkip",
		activeClass: "border-dash-text-muted text-dash-text-muted",
		badgeClass: "bg-dash-bg border-dash-border text-dash-text-muted",
	},
];

const TYPE_ORDER: PortableType[] = ["agent", "command", "skill", "config", "rules", "hooks"];

const TYPE_LABEL_KEYS: Record<PortableType, TranslationKey> = {
	agent: "migrateTypeAgents",
	command: "migrateTypeCommands",
	skill: "migrateTypeSkills",
	config: "migrateTypeConfig",
	rules: "migrateTypeRules",
	hooks: "migrateTypeHooks",
};

const TYPE_BADGE_CLASS: Record<PortableType, string> = {
	agent: "border-dash-accent/30 text-dash-accent",
	command: "border-yellow-500/30 text-yellow-400",
	skill: "border-purple-500/30 text-purple-400",
	config: "border-teal-500/30 text-teal-400",
	rules: "border-rose-500/30 text-rose-400",
	hooks: "border-cyan-500/30 text-cyan-400",
};

const MAX_RENDERED_ACTIONS = 200;

/**
 * Flip destinations allowed per source tab.
 * Conflicts-routed-to-install get the same flip table as install.
 */
const FLIP_DESTINATIONS: Record<ActionTabKey, ActionTabKey[]> = {
	install: ["skip"],
	update: ["skip"],
	delete: ["skip"],
	// Skip → Install only for these reason codes; checked dynamically in FlipMenu
	skip: ["install"],
};

/** Reason codes that allow flipping a skipped item back to Install */
const SKIP_TO_INSTALL_CODES: Set<ReconcileReason> = new Set([
	"user-deleted-respected",
	"user-edits-preserved",
	"target-state-unknown",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDisallowedControlCode(codePoint: number): boolean {
	return (
		(codePoint >= 0x00 && codePoint <= 0x08) ||
		(codePoint >= 0x0b && codePoint <= 0x1f) ||
		(codePoint >= 0x7f && codePoint <= 0x9f)
	);
}

function sanitizeDisplayString(value: string): string {
	let output = "";
	for (const char of value) {
		const codePoint = char.codePointAt(0);
		if (codePoint === undefined) continue;
		if (!isDisallowedControlCode(codePoint)) {
			output += char;
		}
	}
	return output;
}

/**
 * Maps ReconcileReason enum to a TranslationKey.
 * Falls back to using reasonCopy or raw reason string if not found.
 */
function mapReasonCodeToKey(code: ReconcileReason): TranslationKey {
	const map: Record<ReconcileReason, TranslationKey> = {
		"new-item": "migrateReason_newItem",
		"new-provider-for-item": "migrateReason_newProviderForItem",
		"target-deleted-source-changed": "migrateReason_targetDeletedSourceChanged",
		"target-dir-empty-reinstall": "migrateReason_targetDirEmptyReinstall",
		"force-reinstall": "migrateReason_forceReinstall",
		"force-overwrite": "migrateReason_forceOverwrite",
		"registry-upgrade-reinstall": "migrateReason_registryUpgradeReinstall",
		"source-changed": "migrateReason_sourceChanged",
		"registry-upgrade-heal": "migrateReason_registryUpgradeHeal",
		"no-changes": "migrateReason_noChanges",
		"user-edits-preserved": "migrateReason_userEditsPreserved",
		"user-deleted-respected": "migrateReason_userDeletedRespected",
		"target-up-to-date-backfill": "migrateReason_targetUpToDateBackfill",
		"provider-checksum-unavailable": "migrateReason_providerChecksumUnavailable",
		"target-state-unknown": "migrateReason_targetStateUnknown",
		"source-removed-orphan": "migrateReason_sourceRemovedOrphan",
		"renamed-cleanup": "migrateReason_renamedCleanup",
		"path-migrated-cleanup": "migrateReason_pathMigratedCleanup",
		"both-changed": "migrateReason_bothChanged",
		"target-state-unknown-source-changed": "migrateReason_targetStateUnknownSourceChanged",
	};
	return map[code] ?? "migrateReason_targetStateUnknown";
}

/**
 * Groups actions into buckets, routing conflict actions into their natural tab.
 * Conflicts are tracked separately so we can show the conflict banner.
 */
function groupByAction(
	actions: ReconcileAction[],
): Record<ActionTabKey, ReconcileAction[]> & { conflict: ReconcileAction[] } {
	const grouped: Record<ActionTabKey, ReconcileAction[]> & { conflict: ReconcileAction[] } = {
		install: [],
		update: [],
		delete: [],
		skip: [],
		conflict: [],
	};

	for (const action of actions) {
		if (action.action === "conflict") {
			// Route conflicts into install tab (natural action), mark for badge
			grouped.install.push(action);
			grouped.conflict.push(action);
		} else if (
			action.action === "install" ||
			action.action === "update" ||
			action.action === "delete" ||
			action.action === "skip"
		) {
			grouped[action.action].push(action);
		}
	}
	return grouped;
}

function groupByType(actions: ReconcileAction[]): Map<PortableType, ReconcileAction[]> {
	const map = new Map<PortableType, ReconcileAction[]>();
	for (const action of actions) {
		const list = map.get(action.type) ?? [];
		list.push(action);
		map.set(action.type, list);
	}
	return map;
}

/** Sort actions so flipped-to-skip items appear at the end (prevent cap hiding active items) */
function sortWithFlippedLast(
	actions: ReconcileAction[],
	flips: Map<string, "execute" | "skip">,
	keyFn: (a: ReconcileAction) => string,
): ReconcileAction[] {
	return [...actions].sort((a, b) => {
		const aSkipped = flips.get(keyFn(a)) === "skip" ? 1 : 0;
		const bSkipped = flips.get(keyFn(b)) === "skip" ? 1 : 0;
		return aSkipped - bSkipped;
	});
}

// ─── Root component ───────────────────────────────────────────────────────────

export const ReconcilePlanView: React.FC<ReconcilePlanViewProps> = ({
	plan,
	resolutions,
	onResolve,
	actionKey,
	flips,
	onFlip,
	onRespectDeletionsOverride,
}) => {
	const { t } = useI18n();

	const grouped = useMemo(() => groupByAction(plan.actions), [plan.actions]);

	const availableTabs = useMemo(
		() => ACTION_TABS.filter((tab) => grouped[tab.key].length > 0),
		[grouped],
	);

	// Default: first non-empty tab from [install, update, delete, skip]
	const [activeTab, setActiveTab] = useState<ActionTabKey>(() => {
		for (const tab of ACTION_TABS) {
			if (grouped[tab.key].length > 0) return tab.key;
		}
		return "install";
	});

	// Sync active tab when current tab becomes empty after plan changes
	useEffect(() => {
		if (grouped[activeTab]?.length === 0 && availableTabs.length > 0) {
			setActiveTab(availableTabs[0].key);
		}
	}, [grouped, activeTab, availableTabs]);

	const [conflictResolverOpen, setConflictResolverOpen] = useState(false);

	const activeActions = useMemo(
		() => sortWithFlippedLast(grouped[activeTab] ?? [], flips, actionKey),
		[grouped, activeTab, flips, actionKey],
	);

	const typeGroups = useMemo(() => groupByType(activeActions), [activeActions]);

	// Default: skip tab collapsed; update collapsed when large
	const isSkipTab = activeTab === "skip";
	const isUpdateTabLarge = activeTab === "update" && (grouped.update.length ?? 0) > 10;
	const defaultTypeExpanded = !isSkipTab && !isUpdateTabLarge;

	return (
		<div className="space-y-4">
			{/* Empty-dir banners above tab strip */}
			{plan.banners.length > 0 && (
				<div className="space-y-2">
					{plan.banners.map((banner: ReconcileBanner, idx: number) => (
						<EmptyDirBanner
							key={`banner-${idx}`}
							banner={banner}
							onRespectDeletionsOverride={onRespectDeletionsOverride}
						/>
					))}
				</div>
			)}

			{/* Conflict banner (above tabs, below empty-dir banners) */}
			{grouped.conflict.length > 0 && (
				<ConflictBanner
					conflicts={grouped.conflict}
					resolutions={resolutions}
					onResolve={onResolve}
					actionKey={actionKey}
					open={conflictResolverOpen}
					onToggle={() => setConflictResolverOpen((v) => !v)}
				/>
			)}

			{/* Summary bar */}
			<div className="flex flex-wrap gap-2 text-xs">
				{plan.summary.install > 0 && (
					<div className="px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/30 text-green-400">
						{plan.summary.install} {t("migrateActionInstall")}
					</div>
				)}
				{plan.summary.update > 0 && (
					<div className="px-2.5 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
						{plan.summary.update} {t("migrateActionUpdate")}
					</div>
				)}
				{plan.summary.skip > 0 && (
					<div className="px-2.5 py-1 rounded-md bg-dash-bg border border-dash-border text-dash-text-muted">
						{plan.summary.skip} {t("migrateActionSkip")}
					</div>
				)}
				{plan.summary.conflict > 0 && (
					<div className="px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400">
						{plan.summary.conflict} {t("migrateActionConflict")}
					</div>
				)}
				{plan.summary.delete > 0 && (
					<div className="px-2.5 py-1 rounded-md bg-dash-bg border border-dash-border text-dash-text-secondary">
						{plan.summary.delete} {t("migrateActionDelete")}
					</div>
				)}
			</div>

			{/* Tab strip */}
			{availableTabs.length > 1 && (
				<div className="flex gap-1 border-b border-dash-border" role="tablist">
					{availableTabs.map((tab) => {
						const isActive = activeTab === tab.key;
						const count = grouped[tab.key].length;
						return (
							<button
								key={tab.key}
								type="button"
								role="tab"
								aria-selected={isActive}
								onClick={() => setActiveTab(tab.key)}
								className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
									isActive
										? tab.activeClass
										: "border-transparent text-dash-text-muted hover:text-dash-text-secondary"
								}`}
							>
								{t(tab.labelKey)}{" "}
								<span
									className={`ml-1 px-1.5 py-0.5 rounded text-[10px] border ${tab.badgeClass}`}
									aria-label={`${count} items`}
								>
									{count}
								</span>
							</button>
						);
					})}
				</div>
			)}

			{/* Skip tab — collapsed by default with expander */}
			{isSkipTab ? (
				<SkipTabContent
					typeGroups={typeGroups}
					activeTab={activeTab}
					flips={flips}
					onFlip={onFlip}
					actionKey={actionKey}
				/>
			) : (
				/* Normal tab — type sub-sections */
				<div className="space-y-3">
					{TYPE_ORDER.map((type) => {
						const actions = typeGroups.get(type);
						if (!actions || actions.length === 0) return null;
						return (
							<TypeSubSection
								key={`${activeTab}:${type}`}
								type={type}
								count={actions.length}
								defaultExpanded={defaultTypeExpanded}
							>
								{actions.slice(0, MAX_RENDERED_ACTIONS).map((action) => (
									<ActionItem
										key={actionKey(action)}
										action={action}
										sourceTab={activeTab}
										isFlippedToSkip={flips.get(actionKey(action)) === "skip"}
										onFlip={(decision) => onFlip(action, decision)}
										hasConflict={action.action === "conflict"}
										resolutions={resolutions}
										onResolve={onResolve}
										actionKey={actionKey}
									/>
								))}
								{actions.length > MAX_RENDERED_ACTIONS && (
									<div className="text-xs text-dash-text-muted px-1">
										... {actions.length - MAX_RENDERED_ACTIONS} more
									</div>
								)}
							</TypeSubSection>
						);
					})}
				</div>
			)}
		</div>
	);
};

// ─── Skip tab with collapsed-by-default expander ─────────────────────────────

interface SkipTabContentProps {
	typeGroups: Map<PortableType, ReconcileAction[]>;
	activeTab: ActionTabKey;
	flips: Map<string, "execute" | "skip">;
	onFlip: (action: ReconcileAction, decision: "execute" | "skip") => void;
	actionKey: (action: ReconcileAction) => string;
}

const SkipTabContent: React.FC<SkipTabContentProps> = ({
	typeGroups,
	activeTab,
	flips,
	onFlip,
	actionKey,
}) => {
	const { t } = useI18n();
	const [expanded, setExpanded] = useState(false);

	const totalSkip = useMemo(() => {
		let n = 0;
		for (const actions of typeGroups.values()) {
			n += actions.length;
		}
		return n;
	}, [typeGroups]);

	return (
		<div className="border border-dash-border rounded-lg bg-dash-surface">
			<button
				type="button"
				aria-expanded={expanded}
				onClick={() => setExpanded((v) => !v)}
				className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-dash-surface-hover transition-colors"
			>
				<span className="text-sm text-dash-text-muted">
					{expanded ? t("migrateHideSkippedItems") : t("migrateShowSkippedItems")}
					<span className="ml-2 text-xs text-dash-text-muted opacity-70">({totalSkip})</span>
				</span>
				<svg
					aria-hidden="true"
					className={`w-4 h-4 text-dash-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			{expanded && (
				<div className="px-4 pb-4 space-y-3">
					{TYPE_ORDER.map((type) => {
						const actions = typeGroups.get(type);
						if (!actions || actions.length === 0) return null;
						return (
							<TypeSubSection
								key={`${activeTab}:${type}`}
								type={type}
								count={actions.length}
								defaultExpanded={false}
							>
								{actions.slice(0, MAX_RENDERED_ACTIONS).map((action) => (
									<ActionItem
										key={actionKey(action)}
										action={action}
										sourceTab={activeTab}
										isFlippedToSkip={flips.get(actionKey(action)) === "skip"}
										onFlip={(decision) => onFlip(action, decision)}
										hasConflict={false}
										resolutions={new Map()}
										onResolve={() => {}}
										actionKey={actionKey}
									/>
								))}
								{actions.length > MAX_RENDERED_ACTIONS && (
									<div className="text-xs text-dash-text-muted px-1">
										... {actions.length - MAX_RENDERED_ACTIONS} more
									</div>
								)}
							</TypeSubSection>
						);
					})}
				</div>
			)}
		</div>
	);
};

// ─── Conflict banner ───────────────────────────────────────────────────────────

interface ConflictBannerProps {
	conflicts: ReconcileAction[];
	resolutions: Map<string, ConflictResolution>;
	onResolve: (action: ReconcileAction, resolution: ConflictResolution) => void;
	actionKey: (action: ReconcileAction) => string;
	open: boolean;
	onToggle: () => void;
}

const ConflictBanner: React.FC<ConflictBannerProps> = ({
	conflicts,
	resolutions,
	onResolve,
	actionKey,
	open,
	onToggle,
}) => {
	const { t } = useI18n();

	const resolvedCount = useMemo(
		() => conflicts.filter((a) => resolutions.has(actionKey(a))).length,
		[conflicts, resolutions, actionKey],
	);

	return (
		<div className="border border-red-500/30 rounded-lg bg-red-500/5">
			<div className="px-4 py-3 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<svg
						className="w-4 h-4 text-red-400 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<span className="text-sm font-medium text-red-400">
						{t("migrateConflictBanner_title")} ({conflicts.length})
					</span>
					{resolvedCount > 0 && (
						<span className="text-xs text-green-400">
							{resolvedCount}/{conflicts.length} resolved
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={open}
					className="dash-focus-ring px-3 py-1 text-xs font-medium rounded-md bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
				>
					{open ? t("migrateConflictBanner_hide") : t("migrateConflictBanner_cta")}
				</button>
			</div>
			{open && (
				<div className="px-4 pb-4 space-y-3">
					{conflicts.map((action) => (
						<ConflictResolver
							key={actionKey(action)}
							action={action}
							resolution={resolutions.get(actionKey(action)) ?? null}
							onResolve={(resolution) => onResolve(action, resolution)}
						/>
					))}
				</div>
			)}
		</div>
	);
};

// ─── Type sub-section (collapsible) ───────────────────────────────────────────

interface TypeSubSectionProps {
	type: PortableType;
	count: number;
	defaultExpanded?: boolean;
	children: React.ReactNode;
}

const TypeSubSection: React.FC<TypeSubSectionProps> = ({
	type,
	count,
	defaultExpanded = true,
	children,
}) => {
	const { t } = useI18n();
	const [expanded, setExpanded] = useState(defaultExpanded);
	const badgeClass = TYPE_BADGE_CLASS[type];
	const label = t(TYPE_LABEL_KEYS[type]);

	return (
		<div className="border border-dash-border rounded-lg bg-dash-surface">
			<button
				type="button"
				aria-expanded={expanded}
				onClick={() => setExpanded((v) => !v)}
				className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-dash-surface-hover transition-colors"
			>
				<div className="flex items-center gap-2">
					<h4 className="text-sm font-semibold text-dash-text">{label}</h4>
					<span className={`px-2 py-0.5 text-xs rounded-md border ${badgeClass}`}>{count}</span>
				</div>
				<svg
					aria-hidden="true"
					className={`w-4 h-4 text-dash-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			{expanded && <div className="px-4 pt-1 pb-4 space-y-2">{children}</div>}
		</div>
	);
};

// ─── Action item (single plan entry) ──────────────────────────────────────────

interface ActionItemProps {
	action: ReconcileAction;
	sourceTab: ActionTabKey;
	isFlippedToSkip: boolean;
	onFlip: (decision: "execute" | "skip") => void;
	hasConflict: boolean;
	resolutions: Map<string, ConflictResolution>;
	onResolve: (action: ReconcileAction, resolution: ConflictResolution) => void;
	actionKey: (action: ReconcileAction) => string;
}

const ActionItem: React.FC<ActionItemProps> = ({
	action,
	sourceTab,
	isFlippedToSkip,
	onFlip,
	hasConflict,
	resolutions,
	onResolve,
	actionKey,
}) => {
	const { t } = useI18n();
	const [conflictOpen, setConflictOpen] = useState(false);

	// Checkbox is checked when the item is "execute" (not skipped)
	// Default: checked for install/update/delete, unchecked for skip tab
	const isChecked = !isFlippedToSkip;

	const displayName = `${sanitizeDisplayString(action.provider)}/${sanitizeDisplayString(action.item)}`;
	const displayReason =
		action.reasonCopy ??
		(action.reasonCode
			? t(mapReasonCodeToKey(action.reasonCode))
			: sanitizeDisplayString(action.reason));

	const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onFlip(e.target.checked ? "execute" : "skip");
	};

	return (
		<div
			className={`px-3 py-2 bg-dash-bg rounded-md border border-dash-border transition-opacity ${
				isFlippedToSkip ? "opacity-50" : "opacity-100"
			}`}
		>
			<div className="flex items-start gap-2">
				{/* Checkbox */}
				<input
					type="checkbox"
					checked={isChecked}
					onChange={handleCheckboxChange}
					aria-label={`${t("migrateFlip_toggleItem")}: ${displayName}`}
					className="mt-0.5 shrink-0 accent-dash-accent cursor-pointer"
				/>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5 flex-wrap">
						<span className="font-mono text-xs text-dash-text truncate">{displayName}</span>

						{/* Conflict badge — inline, click opens resolver */}
						{hasConflict && (
							<button
								type="button"
								onClick={() => setConflictOpen((v) => !v)}
								className="dash-focus-ring shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
							>
								{t("migrateConflictBadge")}
							</button>
						)}
					</div>

					{/* Reason copy */}
					<div className="text-xs text-dash-text-muted mt-0.5">{displayReason}</div>

					{/* Target path */}
					{action.targetPath && (
						<div className="text-xs text-dash-text-secondary mt-0.5 font-mono truncate">
							{sanitizeDisplayString(action.targetPath)}
						</div>
					)}

					{/* Inline conflict resolver (toggled by badge) */}
					{hasConflict && conflictOpen && (
						<div className="mt-2">
							<ConflictResolver
								action={action}
								resolution={resolutions.get(actionKey(action)) ?? null}
								onResolve={(resolution) => onResolve(action, resolution)}
							/>
						</div>
					)}
				</div>

				{/* Kebab flip menu */}
				<FlipMenu
					sourceTab={sourceTab}
					action={action}
					isFlippedToSkip={isFlippedToSkip}
					onFlip={onFlip}
				/>
			</div>
		</div>
	);
};

// ─── Flip menu (kebab) ─────────────────────────────────────────────────────────

interface FlipMenuProps {
	sourceTab: ActionTabKey;
	action: ReconcileAction;
	isFlippedToSkip: boolean;
	onFlip: (decision: "execute" | "skip") => void;
}

const FlipMenu: React.FC<FlipMenuProps> = ({ sourceTab, action, isFlippedToSkip, onFlip }) => {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	// Determine valid flip destinations
	const allowedDests = FLIP_DESTINATIONS[sourceTab];
	const canFlipToInstall =
		sourceTab === "skip" &&
		allowedDests.includes("install") &&
		action.reasonCode !== undefined &&
		SKIP_TO_INSTALL_CODES.has(action.reasonCode);

	const hasActions = isFlippedToSkip
		? canFlipToInstall || sourceTab !== "skip"
		: allowedDests.length > 0;

	if (!hasActions) return null;

	return (
		<div ref={menuRef} className="relative shrink-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-label="More actions"
				aria-haspopup="true"
				aria-expanded={open}
				className="dash-focus-ring p-1 rounded text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover transition-colors"
			>
				{/* Vertical ellipsis icon */}
				<svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
					<path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
				</svg>
			</button>

			{open && (
				<div className="absolute right-0 top-6 z-10 min-w-[140px] bg-dash-surface border border-dash-border rounded-lg shadow-lg py-1">
					{/* Skip → Install option */}
					{isFlippedToSkip && (canFlipToInstall || sourceTab !== "skip") && (
						<button
							type="button"
							onClick={() => {
								onFlip("execute");
								setOpen(false);
							}}
							className="w-full px-3 py-1.5 text-xs text-left text-dash-text hover:bg-dash-surface-hover"
						>
							{t("migrateFlip_moveToInstall")}
						</button>
					)}
					{/* Execute → Skip option */}
					{!isFlippedToSkip && (
						<button
							type="button"
							onClick={() => {
								onFlip("skip");
								setOpen(false);
							}}
							className="w-full px-3 py-1.5 text-xs text-left text-dash-text hover:bg-dash-surface-hover"
						>
							{t("migrateFlip_moveToSkip")}
						</button>
					)}
					{/* Skip → Install (only for eligible skip reasons) */}
					{!isFlippedToSkip && sourceTab === "skip" && canFlipToInstall && (
						<button
							type="button"
							onClick={() => {
								onFlip("execute");
								setOpen(false);
							}}
							className="w-full px-3 py-1.5 text-xs text-left text-dash-text hover:bg-dash-surface-hover"
						>
							{t("migrateFlip_moveToInstall")}
						</button>
					)}
				</div>
			)}
		</div>
	);
};
