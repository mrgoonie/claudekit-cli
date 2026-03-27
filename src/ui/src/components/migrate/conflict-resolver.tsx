/**
 * ConflictResolver — per-conflict resolution controls
 * Shows item path, reason, resolution buttons, and optional diff viewer
 */

import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";
import type { ConflictResolution, ReconcileAction } from "../../types/reconcile-types";
import { DiffViewer } from "./diff-viewer";

interface ConflictResolverProps {
	action: ReconcileAction;
	resolution: ConflictResolution | null;
	onResolve: (resolution: ConflictResolution) => void;
}

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

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
	action,
	resolution,
	onResolve,
}) => {
	const { t } = useI18n();
	const [showDiff, setShowDiff] = useState(false);

	const hasOwnedSections = action.ownedSections && action.ownedSections.length > 0;

	return (
		<div className="border border-dash-border rounded-lg p-4 mb-3 bg-dash-surface">
			<div className="flex justify-between items-start gap-4">
				<div className="flex-1 min-w-0">
					<div className="font-mono text-sm text-dash-text truncate">
						{sanitizeDisplayString(action.provider)}/{sanitizeDisplayString(action.type)}/
						{sanitizeDisplayString(action.item)}
					</div>
					<p className="text-xs text-dash-text-muted mt-1">
						{sanitizeDisplayString(action.reason)}
					</p>
					{action.targetPath && (
						<p className="text-xs text-dash-text-secondary mt-1 font-mono truncate">
							{sanitizeDisplayString(action.targetPath)}
						</p>
					)}
				</div>

				<div className="flex flex-wrap gap-2 items-center">
					<button
						type="button"
						onClick={() => onResolve({ type: "overwrite" })}
						className={`dash-focus-ring px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
							resolution?.type === "overwrite"
								? "bg-dash-accent text-white"
								: "bg-dash-bg border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
						}`}
					>
						{t("migrateConflictUseCK")}
					</button>
					<button
						type="button"
						onClick={() => onResolve({ type: "keep" })}
						className={`dash-focus-ring px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
							resolution?.type === "keep"
								? "bg-dash-accent text-white"
								: "bg-dash-bg border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
						}`}
					>
						{t("migrateConflictKeepMine")}
					</button>
					{hasOwnedSections && (
						<button
							type="button"
							onClick={() => onResolve({ type: "smart-merge" })}
							className={`dash-focus-ring px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
								resolution?.type === "smart-merge"
									? "bg-dash-accent text-white"
									: "bg-dash-bg border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
							}`}
						>
							{t("migrateConflictSmartMerge")}
						</button>
					)}
					{action.diff && (
						<button
							type="button"
							onClick={() => setShowDiff(!showDiff)}
							className="dash-focus-ring px-3 py-1.5 text-xs font-medium rounded-md border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
						>
							{showDiff ? t("migrateConflictHideDiff") : t("migrateConflictShowDiff")}
						</button>
					)}
				</div>
			</div>

			{showDiff && action.diff && <DiffViewer diff={action.diff} className="mt-3" />}

			{resolution && (
				<div className="mt-2 text-xs text-green-400 flex items-center gap-1.5">
					<svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fillRule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clipRule="evenodd"
						/>
					</svg>
					<span>
						{t("migrateConflictResolved")}: {getResolutionLabel(resolution.type, t)}
					</span>
				</div>
			)}
		</div>
	);
};

function getResolutionLabel(type: string, t: (key: any) => string): string {
	switch (type) {
		case "overwrite":
			return t("migrateConflictUseCK");
		case "keep":
			return t("migrateConflictKeepMine");
		case "smart-merge":
			return t("migrateConflictSmartMerge");
		case "resolved":
			return t("migrateConflictManual");
		default:
			return String(type);
	}
}
