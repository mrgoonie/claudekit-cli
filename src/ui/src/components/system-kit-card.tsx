/**
 * SystemKitCard - Kit card with version, update check, compact inventory, ownership summary, status dot
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../i18n";
import type { Channel } from "./system-channel-toggle";
import { getCategoryCounts, getOwnershipCounts } from "./system-dashboard-helpers";
import SystemStatusDot from "./system-status-dot";
import SystemVersionDropdown from "./system-version-dropdown";
import UpdateProgressModal from "./system-update-progress-modal";

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

const SystemKitCard: React.FC<{
	kitName: string;
	kit: KitData;
	channel?: Channel;
	externalStatus?: UpdateStatus;
	externalLatestVersion?: string | null;
	onStatusChange?: (status: UpdateStatus, latestVersion: string | null) => void;
	disabled?: boolean;
}> = ({ kitName, kit, channel = "stable", externalStatus, externalLatestVersion, onStatusChange, disabled }) => {
	const { t } = useI18n();
	const [internalStatus, setInternalStatus] = useState<UpdateStatus>("idle");
	const [internalLatestVersion, setInternalLatestVersion] = useState<string | null>(null);
	const [showUpdateModal, setShowUpdateModal] = useState(false);
	const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

	// Use external state if provided, otherwise internal state
	const updateStatus = externalStatus ?? internalStatus;
	const latestVersion = externalLatestVersion ?? internalLatestVersion;

	const files = (kit.files ?? []) as TrackedFile[];
	const ownership = getOwnershipCounts(files);
	const categories = getCategoryCounts(files);

	const handleCheckUpdate = async () => {
		const setStatus = (status: UpdateStatus) => {
			if (onStatusChange) {
				return;
			}
			setInternalStatus(status);
		};

		const setLatest = (latest: string | null) => {
			if (onStatusChange) {
				return;
			}
			setInternalLatestVersion(latest);
		};

		setStatus("checking");
		if (onStatusChange) {
			onStatusChange("checking", null);
		}

		try {
			const res = await fetch(`/api/system/check-updates?target=kit&kit=${kitName}&channel=${channel}`);
			const data: UpdateResult = await res.json();
			if (data.updateAvailable) {
				setStatus("update-available");
				setLatest(data.latest);
				if (onStatusChange) {
					onStatusChange("update-available", data.latest);
				}
			} else {
				setStatus("up-to-date");
				if (onStatusChange) {
					onStatusChange("up-to-date", null);
				}
			}
		} catch {
			setStatus("idle");
			if (onStatusChange) {
				onStatusChange("idle", null);
			}
		}
	};

	const handleUpdateComplete = async () => {
		// Refetch system info by reloading page
		window.location.reload();
	};

	return (
		<>
			<div className="bg-dash-bg border border-dash-border rounded-lg p-5 space-y-4">
				{/* Header row: name + version + update button */}
				<div className="flex items-start justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<SystemStatusDot status={updateStatus} ariaLabel={t(updateStatus === "up-to-date" ? "upToDate" : updateStatus === "update-available" ? "updateAvailable" : "checking")} />
							<h3 className="text-base font-bold text-dash-text capitalize">{kitName} Kit</h3>
						{channel === "beta" && (
							<span className="px-2 py-0.5 text-xs font-medium bg-amber-500 text-white rounded">
								{t("betaBadge")}
							</span>
						)}
						</div>
						<div className="flex items-center gap-4 mt-1 text-sm text-dash-text-secondary">
							<span>v{(kit.version ?? "?").replace(/^v/, "")}</span>
							{kit.installedAt && (
								<span className="text-dash-text-muted">
									{new Date(kit.installedAt).toLocaleDateString()}
								</span>
							)}
						</div>
						{updateStatus === "update-available" && latestVersion && (
							<div className="mt-1 text-xs text-amber-500">
								v{(kit.version ?? "?").replace(/^v/, "")} → v{latestVersion.replace(/^v/, "")}
							</div>
						)}
					</div>
					<UpdateButton
						status={updateStatus}
						currentVersion={kit.version ?? "0.0.0"}
						latestVersion={latestVersion}
						kitName={kitName}
						onCheck={handleCheckUpdate}
						onUpdate={() => setShowUpdateModal(true)}
						onVersionSelect={setSelectedVersion}
						disabled={disabled}
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
			<UpdateProgressModal
				isOpen={showUpdateModal}
				onClose={() => setShowUpdateModal(false)}
				target="kit"
				kitName={kitName}
				targetVersion={selectedVersion ?? latestVersion ?? undefined}
				onComplete={handleUpdateComplete}
			/>
		</>
	);
};

// Update button with states
const UpdateButton: React.FC<{
	status: UpdateStatus;
	currentVersion: string;
	latestVersion: string | null;
	kitName: string;
	onCheck: () => void;
	onUpdate: () => void;
	onVersionSelect: (version: string) => void;
	disabled?: boolean;
}> = ({ status, currentVersion, latestVersion, kitName, onCheck, onUpdate, onVersionSelect, disabled }) => {
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
	if (status === "update-available" && latestVersion) {
		return (
			<div className="flex items-center gap-2">
				<SystemVersionDropdown
					target="kit"
					kitName={kitName}
					currentVersion={currentVersion}
					latestVersion={latestVersion}
					onVersionSelect={(ver) => {
						onVersionSelect(ver);
						onUpdate();
					}}
				/>
			</div>
		);
	}
	return (
		<button
			type="button"
			onClick={onCheck}
			disabled={disabled}
			className="text-xs text-dash-accent hover:text-dash-accent-hover transition-colors disabled:text-dash-text-muted disabled:cursor-not-allowed"
		>
			{t("checkForUpdates")}
		</button>
	);
};

export default SystemKitCard;
