/**
 * SystemCliCard - CLI version card with update check button
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../i18n";

type UpdateStatus = "idle" | "checking" | "up-to-date" | "update-available";

interface UpdateResult {
	current: string;
	latest: string | null;
	updateAvailable: boolean;
}

interface SystemCliCardProps {
	version: string;
	installedAt?: string;
}

const SystemCliCard: React.FC<SystemCliCardProps> = ({ version, installedAt }) => {
	const { t } = useI18n();
	const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
	const [latestVersion, setLatestVersion] = useState<string | null>(null);

	const handleCheckUpdate = async () => {
		setUpdateStatus("checking");
		try {
			const res = await fetch("/api/system/check-updates?target=cli");
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
		<div className="bg-dash-bg border border-dash-border rounded-lg p-5">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="text-base font-bold text-dash-text">{t("cliCard")}</h3>
					<div className="flex items-center gap-4 mt-1 text-sm text-dash-text-secondary">
						<span>v{version}</span>
						{installedAt && (
							<span className="text-dash-text-muted">
								{new Date(installedAt).toLocaleDateString()}
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
		</div>
	);
};

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

export default SystemCliCard;
