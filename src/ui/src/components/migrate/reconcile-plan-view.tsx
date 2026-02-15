/**
 * ReconcilePlanView — displays migration plan grouped by action type
 * Shows summary bar with counts, conflicts prominently, skip group collapsed
 */

import type React from "react";
import { useMemo, useState } from "react";
import { useI18n } from "../../i18n";
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

interface GroupedActions {
	install: ReconcileAction[];
	update: ReconcileAction[];
	skip: ReconcileAction[];
	conflict: ReconcileAction[];
	delete: ReconcileAction[];
}

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

function groupActions(actions: ReconcileAction[]): GroupedActions {
	const grouped: GroupedActions = {
		install: [],
		update: [],
		skip: [],
		conflict: [],
		delete: [],
	};

	for (const action of actions) {
		const key = action.action as keyof GroupedActions;
		grouped[key].push(action);
	}

	return grouped;
}

export const ReconcilePlanView: React.FC<ReconcilePlanViewProps> = ({
	plan,
	resolutions,
	onResolve,
	actionKey,
}) => {
	const { t } = useI18n();
	const [skipExpanded, setSkipExpanded] = useState(false);

	const grouped = useMemo(() => groupActions(plan.actions), [plan.actions]);

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

			{/* Conflict section (prominent if any) */}
			{grouped.conflict.length > 0 && (
				<div className="border border-red-500/30 rounded-lg bg-red-500/5">
					<div className="px-4 py-3 border-b border-red-500/20">
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
					</div>
					<div className="p-4 space-y-3">
						{grouped.conflict.map((action) => (
							<ConflictResolver
								key={actionKey(action)}
								action={action}
								resolution={resolutions.get(actionKey(action)) || null}
								onResolve={(resolution) => onResolve(action, resolution)}
							/>
						))}
					</div>
				</div>
			)}

			{/* Install section */}
			{grouped.install.length > 0 && (
				<ActionGroup
					title={t("migrateActionInstall")}
					actions={grouped.install}
					badgeClass="bg-green-500/10 border-green-500/30 text-green-400"
				/>
			)}

			{/* Update section */}
			{grouped.update.length > 0 && (
				<ActionGroup
					title={t("migrateActionUpdate")}
					actions={grouped.update}
					badgeClass="bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
				/>
			)}

			{/* Delete section */}
			{grouped.delete.length > 0 && (
				<ActionGroup
					title={t("migrateActionDelete")}
					actions={grouped.delete}
					badgeClass="bg-dash-bg border-dash-border text-dash-text-secondary"
				/>
			)}

			{/* Skip group (collapsed by default) */}
			{grouped.skip.length > 0 && (
				<div className="border border-dash-border rounded-lg bg-dash-surface">
					<button
						type="button"
						onClick={() => setSkipExpanded(!skipExpanded)}
						className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-dash-surface-hover transition-colors"
					>
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold text-dash-text-muted">
								{t("migrateActionSkip")} ({grouped.skip.length} {t("migrateUnchanged")})
							</span>
						</div>
						<svg
							className={`w-4 h-4 text-dash-text-muted transition-transform ${skipExpanded ? "rotate-180" : ""}`}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>
					{skipExpanded && (
						<div className="px-4 pb-4 space-y-2">
							{grouped.skip.slice(0, MAX_RENDERED_ACTIONS).map((action) => (
								<ActionItem key={actionKey(action)} action={action} />
							))}
							{grouped.skip.length > MAX_RENDERED_ACTIONS && (
								<div className="text-xs text-dash-text-muted">
									... {grouped.skip.length - MAX_RENDERED_ACTIONS} more skipped action(s)
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

interface ActionGroupProps {
	title: string;
	actions: ReconcileAction[];
	badgeClass: string;
}

const ActionGroup: React.FC<ActionGroupProps> = ({ title, actions, badgeClass }) => {
	const shown = actions.slice(0, MAX_RENDERED_ACTIONS);
	const hidden = actions.length - shown.length;
	return (
		<div className="border border-dash-border rounded-lg bg-dash-surface">
			<div className="px-4 py-3 border-b border-dash-border">
				<div className="flex items-center gap-2">
					<h3 className="text-sm font-semibold text-dash-text">{title}</h3>
					<span className={`px-2 py-0.5 text-xs rounded-md border ${badgeClass}`}>
						{actions.length}
					</span>
				</div>
			</div>
			<div className="p-4 space-y-2">
				{shown.map((action) => (
					<ActionItem
						key={`${action.provider}:${action.type}:${action.item}:${action.global}:${action.action}`}
						action={action}
					/>
				))}
				{hidden > 0 && (
					<div className="text-xs text-dash-text-muted">... {hidden} more action(s)</div>
				)}
			</div>
		</div>
	);
};

interface ActionItemProps {
	action: ReconcileAction;
}

const ActionItem: React.FC<ActionItemProps> = ({ action }) => {
	return (
		<div className="px-3 py-2 bg-dash-bg rounded-md border border-dash-border">
			<div className="font-mono text-xs text-dash-text">
				{sanitizeDisplayString(action.provider)}/{sanitizeDisplayString(action.type)}/
				{sanitizeDisplayString(action.item)}
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
