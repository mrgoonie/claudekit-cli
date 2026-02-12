/**
 * SystemBatchControls - Batch operations for checking and updating all components
 */
import type React from "react";
import { useI18n } from "../i18n";
import type { UpdateStatus } from "./system-status-dot";

export interface ComponentUpdateState {
	id: string; // 'cli' | kit name
	type: "cli" | "kit";
	status: UpdateStatus;
	currentVersion: string;
	latestVersion: string | null;
}

interface SystemBatchControlsProps {
	components: ComponentUpdateState[];
	isChecking: boolean;
	isUpdating: boolean;
	onCheckAll: () => void;
	onUpdateAll: () => void;
	className?: string;
}

const SystemBatchControls: React.FC<SystemBatchControlsProps> = ({
	components,
	isChecking,
	isUpdating,
	onCheckAll,
	onUpdateAll,
	className,
}) => {
	const { t } = useI18n();

	const updatesAvailable = components.filter((c) => c.status === "update-available").length;
	const allUpToDate =
		components.length > 0 &&
		components.every((c) => c.status === "up-to-date" || c.status === "idle");
	const checkedCount = components.filter((c) => c.status === "up-to-date").length;

	return (
		<div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
			<div className="inline-flex items-center gap-2 rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-xs">
				{isChecking ? (
					<>
						<span className="w-3 h-3 border-2 border-dash-text-muted border-t-transparent rounded-full animate-spin" />
						<span className="text-dash-text-secondary">{t("checkingAll")}</span>
					</>
				) : updatesAvailable > 0 ? (
					<span className="text-amber-500 font-semibold">
						{t("updatesAvailable").replace("{count}", updatesAvailable.toString())}
					</span>
				) : allUpToDate ? (
					<span className="text-emerald-500 font-semibold">{t("allUpToDate")}</span>
				) : (
					<span className="text-dash-text-secondary font-medium">{t("readyToScan")}</span>
				)}
				{checkedCount > 0 && (
					<span className="mono text-dash-text-muted border-l border-dash-border pl-2">
						{checkedCount}
					</span>
				)}
			</div>

			<button
				type="button"
				onClick={onCheckAll}
				disabled={isChecking || isUpdating}
				className="dash-focus-ring px-3 py-2 rounded-lg text-xs font-semibold border border-dash-border bg-dash-surface text-dash-text-secondary hover:text-dash-text hover:bg-dash-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{t("checkAll")}
			</button>

			{updatesAvailable > 0 && (
				<button
					type="button"
					onClick={onUpdateAll}
					disabled={isUpdating}
					className="dash-focus-ring px-3 py-2 rounded-lg text-xs font-semibold bg-dash-accent text-dash-bg hover:bg-dash-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{t("updateAll")}
				</button>
			)}
		</div>
	);
};

export default SystemBatchControls;
