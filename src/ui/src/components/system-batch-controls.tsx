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
}

const SystemBatchControls: React.FC<SystemBatchControlsProps> = ({
	components,
	isChecking,
	isUpdating,
	onCheckAll,
	onUpdateAll,
}) => {
	const { t } = useI18n();

	const updatesAvailable = components.filter((c) => c.status === "update-available").length;
	const allUpToDate =
		components.length > 0 &&
		components.every((c) => c.status === "up-to-date" || c.status === "idle");

	return (
		<div className="bg-dash-bg border border-dash-border rounded-lg p-4 mb-4">
			<div className="flex items-center justify-between gap-4">
				{/* Status display */}
				<div className="flex items-center gap-3">
					{updatesAvailable > 0 && (
						<span className="text-sm font-medium text-amber-500">
							{t("updatesAvailable").replace("{count}", updatesAvailable.toString())}
						</span>
					)}
					{allUpToDate && !isChecking && (
						<span className="text-sm font-medium text-emerald-500">{t("allUpToDate")}</span>
					)}
					{isChecking && (
						<span className="text-sm text-dash-text-muted flex items-center gap-2">
							<span className="w-3 h-3 border-2 border-dash-text-muted border-t-transparent rounded-full animate-spin" />
							{t("checkingAll")}
						</span>
					)}
				</div>

				{/* Action buttons */}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onCheckAll}
						disabled={isChecking || isUpdating}
						className="px-3 py-1.5 text-xs font-medium text-dash-accent hover:text-dash-accent-hover disabled:text-dash-text-muted disabled:cursor-not-allowed transition-colors"
					>
						{t("checkAll")}
					</button>

					{updatesAvailable > 0 && (
						<button
							type="button"
							onClick={onUpdateAll}
							disabled={isUpdating}
							className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-dash-bg disabled:text-dash-text-muted disabled:cursor-not-allowed transition-colors"
						>
							{t("updateAll")}
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default SystemBatchControls;
