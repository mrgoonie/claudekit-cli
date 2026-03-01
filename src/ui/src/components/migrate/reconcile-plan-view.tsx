/**
 * ReconcilePlanView — displays migration plan with action tabs + type sub-sections
 * Tab bar for Install/Update/Conflict/Delete/Skip, each tab groups items by type
 */

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { type TranslationKey, useI18n } from "../../i18n";
import type {
	ConflictResolution,
	ReconcileAction,
	ReconcilePlan,
} from "../../types/reconcile-types";
import { ConflictResolver } from "./conflict-resolver";

interface ReconcilePlanViewProps {
	plan: ReconcilePlan;
	resolutions: Map<string, ConflictResolution>;
	onResolve: (action: ReconcileAction, resolution: ConflictResolution) => void;
	actionKey: (action: ReconcileAction) => string;
}

type ActionTabKey = "install" | "update" | "conflict" | "delete" | "skip";
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
		key: "conflict",
		labelKey: "migrateActionConflict",
		activeClass: "border-red-400 text-red-400",
		badgeClass: "bg-red-500/10 border-red-500/30 text-red-400",
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

function groupByAction(actions: ReconcileAction[]): Record<ActionTabKey, ReconcileAction[]> {
	const grouped: Record<ActionTabKey, ReconcileAction[]> = {
		install: [],
		update: [],
		skip: [],
		conflict: [],
		delete: [],
	};
	for (const action of actions) {
		grouped[action.action as ActionTabKey].push(action);
	}
	return grouped;
}

function groupByType(actions: ReconcileAction[]): Map<PortableType, ReconcileAction[]> {
	const map = new Map<PortableType, ReconcileAction[]>();
	for (const action of actions) {
		const list = map.get(action.type) || [];
		list.push(action);
		map.set(action.type, list);
	}
	return map;
}

export const ReconcilePlanView: React.FC<ReconcilePlanViewProps> = ({
	plan,
	resolutions,
	onResolve,
	actionKey,
}) => {
	const { t } = useI18n();
	const grouped = useMemo(() => groupByAction(plan.actions), [plan.actions]);

	// Available tabs (only those with items)
	const availableTabs = useMemo(
		() => ACTION_TABS.filter((tab) => grouped[tab.key].length > 0),
		[grouped],
	);

	// Default to conflict tab if present, else install
	const [activeTab, setActiveTab] = useState<ActionTabKey>(() => {
		if (grouped.conflict.length > 0) return "conflict";
		if (grouped.install.length > 0) return "install";
		return availableTabs[0]?.key ?? "install";
	});

	// Sync activeTab when current tab becomes empty (e.g. after plan changes)
	useEffect(() => {
		if (grouped[activeTab]?.length === 0 && availableTabs.length > 0) {
			setActiveTab(availableTabs[0].key);
		}
	}, [grouped, activeTab, availableTabs]);

	const activeActions = useMemo(() => grouped[activeTab] ?? [], [grouped, activeTab]);
	const typeGroups = useMemo(() => groupByType(activeActions), [activeActions]);

	const handleBatchResolve = (type: "overwrite" | "keep") => {
		for (const action of grouped.conflict) {
			onResolve(action, { type });
		}
	};

	return (
		<div className="space-y-4">
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

			{/* Action tabs */}
			{availableTabs.length > 1 && (
				<div className="flex gap-1 border-b border-dash-border">
					{availableTabs.map((tab) => {
						const isActive = activeTab === tab.key;
						return (
							<button
								key={tab.key}
								type="button"
								onClick={() => setActiveTab(tab.key)}
								className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
									isActive
										? tab.activeClass
										: "border-transparent text-dash-text-muted hover:text-dash-text-secondary"
								}`}
							>
								{t(tab.labelKey)}{" "}
								<span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] border ${tab.badgeClass}`}>
									{grouped[tab.key].length}
								</span>
							</button>
						);
					})}
				</div>
			)}

			{/* Conflict batch actions */}
			{activeTab === "conflict" && grouped.conflict.length > 0 && (
				<div className="flex items-center justify-between gap-3">
					<h3 className="text-sm font-semibold text-red-400">
						{t("migrateConflictSectionTitle")} ({grouped.conflict.length})
					</h3>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => handleBatchResolve("overwrite")}
							className="dash-focus-ring px-3 py-1 text-xs font-medium rounded-md bg-dash-bg border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
						>
							{t("migrateConflictOverwriteAll")}
						</button>
						<button
							type="button"
							onClick={() => handleBatchResolve("keep")}
							className="dash-focus-ring px-3 py-1 text-xs font-medium rounded-md bg-dash-bg border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
						>
							{t("migrateConflictKeepAll")}
						</button>
					</div>
				</div>
			)}

			{/* Type sub-sections within active tab */}
			{activeTab === "conflict"
				? TYPE_ORDER.map((type) => {
						const actions = typeGroups.get(type);
						if (!actions || actions.length === 0) return null;
						return (
							<TypeSubSection key={`${activeTab}:${type}`} type={type} count={actions.length}>
								{actions.slice(0, MAX_RENDERED_ACTIONS).map((action) => (
									<ConflictResolver
										key={actionKey(action)}
										action={action}
										resolution={resolutions.get(actionKey(action)) || null}
										onResolve={(resolution) => onResolve(action, resolution)}
									/>
								))}
								{actions.length > MAX_RENDERED_ACTIONS && (
									<div className="text-xs text-dash-text-muted">
										... {actions.length - MAX_RENDERED_ACTIONS} more
									</div>
								)}
							</TypeSubSection>
						);
					})
				: TYPE_ORDER.map((type) => {
						const actions = typeGroups.get(type);
						if (!actions || actions.length === 0) return null;
						return (
							<TypeSubSection
								key={`${activeTab}:${type}`}
								type={type}
								count={actions.length}
								defaultExpanded={activeTab !== "skip"}
							>
								{actions.slice(0, MAX_RENDERED_ACTIONS).map((action) => (
									<ActionItem
										key={`${action.provider}:${action.type}:${action.item}:${action.global}:${action.action}`}
										action={action}
									/>
								))}
								{actions.length > MAX_RENDERED_ACTIONS && (
									<div className="text-xs text-dash-text-muted">
										... {actions.length - MAX_RENDERED_ACTIONS} more
									</div>
								)}
							</TypeSubSection>
						);
					})}
		</div>
	);
};

/* ─── Type sub-section (collapsible, matches summary report style) ─── */

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
				onClick={() => setExpanded(!expanded)}
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

/* ─── Action item (single plan entry) ─── */

const ActionItem: React.FC<{ action: ReconcileAction }> = ({ action }) => {
	return (
		<div className="px-3 py-2 bg-dash-bg rounded-md border border-dash-border">
			<div className="font-mono text-xs text-dash-text">
				{sanitizeDisplayString(action.provider)}/{sanitizeDisplayString(action.item)}
			</div>
			<div className="text-xs text-dash-text-muted mt-1">
				{sanitizeDisplayString(action.reason)}
			</div>
			{action.targetPath && (
				<div className="text-xs text-dash-text-secondary mt-0.5 font-mono truncate">
					{sanitizeDisplayString(action.targetPath)}
				</div>
			)}
		</div>
	);
};
