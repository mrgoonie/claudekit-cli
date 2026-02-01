/**
 * SystemKitCard - Kit card with version, update check, compact inventory, ownership summary
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../i18n";
import { getCategoryCounts, getOwnershipCounts } from "./system-dashboard-helpers";

interface TrackedFile {
	path: string;
	checksum: string;
	ownership: "ck" | "user" | "ck-modified";
}

export interface KitData {
	version?: string;
	installedAt?: string;
	files?: TrackedFile[];
}

type UpdateStatus = "idle" | "checking" | "up-to-date" | "update-available";

interface UpdateResult {
	current: string;
	latest: string | null;
	updateAvailable: boolean;
	releaseUrl?: string;
}

const SystemKitCard: React.FC<{ kitName: string; kit: KitData }> = ({ kitName, kit }) => {
	const { t } = useI18n();
	const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
	const [latestVersion, setLatestVersion] = useState<string | null>(null);

	const files = (kit.files ?? []) as TrackedFile[];
	const ownership = getOwnershipCounts(files);
	const categories = getCategoryCounts(files);

	const handleCheckUpdate = async () => {
		setUpdateStatus("checking");
		try {
			const res = await fetch(`/api/system/check-updates?target=kit&kit=${kitName}`);
			const data: UpdateResult = await res.json();
			if (data.updateAvailable) {
				setUpdateStatus("update-available");
				setLatestVersion(data.latest);
			} else {
				setUpdateStatus("up-to-date");
			}
		} catch {
			setUpdateStatus("idle");
		}
	};

	return (
		<div className="bg-dash-bg border border-dash-border rounded-lg p-5 space-y-4">
			{/* Header row: name + version + update button */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="text-base font-bold text-dash-text capitalize">{kitName} Kit</h3>
					<div className="flex items-center gap-4 mt-1 text-sm text-dash-text-secondary">
						<span>v{kit.version ?? "?"}</span>
						{kit.installedAt && (
							<span className="text-dash-text-muted">
								{new Date(kit.installedAt).toLocaleDateString()}
							</span>
						)}
					</div>
				</div>
				<UpdateButton
					status={updateStatus}
					latestVersion={latestVersion}
					onClick={handleCheckUpdate}
				/>
			</div>

			{/* Component inventory - compact grid */}
			{files.length > 0 && (
				<div className="grid grid-cols-3 gap-1.5">
					{Object.entries(categories)
						.filter(([, count]) => count > 0)
						.map(([cat, count]) => (
							<div
								key={cat}
								className="flex items-center justify-between px-2 py-1 bg-dash-surface border border-dash-border rounded text-xs"
							>
								<span className="text-dash-text-secondary capitalize">{cat}</span>
								<span className="font-bold mono text-dash-text">{count}</span>
							</div>
						))}
				</div>
			)}

			{/* Ownership summary - single line */}
			{files.length > 0 && (
				<div className="flex items-center gap-4 text-xs text-dash-text-muted">
					<span className="flex items-center gap-1.5">
						<span className="w-2 h-2 rounded-full bg-emerald-500" />
						{ownership.ck} {t("ownershipCk")}
					</span>
					{ownership.user > 0 && (
						<span className="flex items-center gap-1.5">
							<span className="w-2 h-2 rounded-full bg-blue-500" />
							{ownership.user} {t("ownershipUser")}
						</span>
					)}
				</div>
			)}
		</div>
	);
};

// Update button with states
const UpdateButton: React.FC<{
	status: UpdateStatus;
	latestVersion: string | null;
	onClick: () => void;
}> = ({ status, latestVersion, onClick }) => {
	const { t } = useI18n();

	if (status === "checking") {
		return (
			<span className="text-xs text-dash-text-muted flex items-center gap-1.5">
				<span className="w-3 h-3 border-2 border-dash-text-muted border-t-transparent rounded-full animate-spin" />
				{t("checking")}
			</span>
		);
	}
	if (status === "up-to-date") {
		return <span className="text-xs text-emerald-500 font-medium">{t("upToDate")}</span>;
	}
	if (status === "update-available") {
		return (
			<span className="text-xs text-amber-500 font-medium">
				{t("updateAvailable")}: v{latestVersion}
			</span>
		);
	}
	return (
		<button
			type="button"
			onClick={onClick}
			className="text-xs text-dash-accent hover:text-dash-accent-hover transition-colors"
		>
			{t("checkForUpdates")}
		</button>
	);
};

export default SystemKitCard;
