/**
 * SystemCliCard - CLI version card with update check button, status dot, version diff
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../i18n";
import type { Channel } from "./system-channel-toggle";
import SystemStatusDot, { type UpdateStatus } from "./system-status-dot";
import SystemVersionDropdown from "./system-version-dropdown";
import UpdateProgressModal from "./system-update-progress-modal";

type UpdateStatus = "idle" | "checking" | "up-to-date" | "update-available";

interface UpdateResult {
	current: string;
	latest: string | null;
	updateAvailable: boolean;
}

interface SystemCliCardProps {
	version: string;
	installedAt?: string;
	channel?: Channel;
	externalStatus?: UpdateStatus;
	externalLatestVersion?: string | null;
	onStatusChange?: (status: UpdateStatus, latestVersion: string | null) => void;
	disabled?: boolean;
}

const SystemCliCard: React.FC<SystemCliCardProps> = ({
	version,
	installedAt,
	channel = "stable",
	externalStatus,
	externalLatestVersion,
	onStatusChange,
	disabled,
}) => {
	const { t } = useI18n();
	const [internalStatus, setInternalStatus] = useState<UpdateStatus>("idle");
	const [internalLatestVersion, setInternalLatestVersion] = useState<string | null>(null);
	const [showUpdateModal, setShowUpdateModal] = useState(false);
	const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

	// Use external state if provided, otherwise internal state
	const updateStatus = externalStatus ?? internalStatus;
	const latestVersion = externalLatestVersion ?? internalLatestVersion;

	const handleCheckUpdate = async () => {
		const setStatus = (status: UpdateStatus) => {
			if (onStatusChange) {
				// External control - notify parent
				return;
			}
			setInternalStatus(status);
		};

		const setLatest = (latest: string | null) => {
			if (onStatusChange) {
				// External control - notify parent
				return;
			}
			setInternalLatestVersion(latest);
		};

		setStatus("checking");
		if (onStatusChange) {
			onStatusChange("checking", null);
		}

		try {
			const res = await fetch(`/api/system/check-updates?target=cli&channel=${channel}`);
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
		// Refetch version info by reloading page
		window.location.reload();
	};

	return (
		<>
			<div className="bg-dash-bg border border-dash-border rounded-lg p-5">
				<div className="flex items-start justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<SystemStatusDot
								status={updateStatus}
								ariaLabel={t(
									updateStatus === "up-to-date"
										? "upToDate"
										: updateStatus === "update-available"
											? "updateAvailable"
											: "checking",
								)}
							/>
							<h3 className="text-base font-bold text-dash-text">{t("cliCard")}</h3>
							{channel === "beta" && (
								<span className="px-2 py-0.5 text-xs font-medium bg-amber-500 text-white rounded">
									{t("betaBadge")}
								</span>
							)}
						</div>
						<div className="flex items-center gap-4 mt-1 text-sm text-dash-text-secondary">
							<span>v{version.replace(/^v/, "")}</span>
							{installedAt && (
								<span className="text-dash-text-muted">
									{new Date(installedAt).toLocaleDateString()}
								</span>
							)}
						</div>
						{updateStatus === "update-available" && latestVersion && (
							<div className="mt-1 text-xs text-amber-500">
								v{version.replace(/^v/, "")} → v{latestVersion.replace(/^v/, "")}
							</div>
						)}
					</div>
					<UpdateButton
						status={updateStatus}
						currentVersion={version}
						latestVersion={latestVersion}
						onCheck={handleCheckUpdate}
						onUpdate={() => setShowUpdateModal(true)}
						onVersionSelect={setSelectedVersion}
						disabled={disabled}
					/>
				</div>
			</div>
			<UpdateProgressModal
				isOpen={showUpdateModal}
				onClose={() => setShowUpdateModal(false)}
				target="cli"
				targetVersion={selectedVersion ?? latestVersion ?? undefined}
				onComplete={handleUpdateComplete}
			/>
		</>
	);
};

const UpdateButton: React.FC<{
	status: UpdateStatus;
	currentVersion: string;
	latestVersion: string | null;
	onCheck: () => void;
	onUpdate: () => void;
	onVersionSelect: (version: string) => void;
	disabled?: boolean;
}> = ({ status, currentVersion, latestVersion, onCheck, onUpdate, onVersionSelect, disabled }) => {
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
					target="cli"
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

export default SystemCliCard;
