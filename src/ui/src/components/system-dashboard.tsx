/**
 * SystemDashboard - System health dashboard for Config Editor
 * Shows CLI version, kit cards with update checks, and environment info
 * Manages batch operations (Check All, Update All) with lifted state
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import SystemBatchControls, { type ComponentUpdateState } from "./system-batch-controls";
import SystemChannelToggle, { type Channel } from "./system-channel-toggle";
import SystemCliCard from "./system-cli-card";
import SystemEnvironmentCard from "./system-environment-card";
import SystemKitCard, { type KitData } from "./system-kit-card";
import type { UpdateStatus } from "./system-status-dot";
import UpdateProgressModal from "./system-update-progress-modal";

interface SystemInfo {
	configPath: string;
	nodeVersion: string;
	bunVersion: string;
	os: string;
	cliVersion: string;
}

interface SystemDashboardProps {
	metadata: Record<string, unknown>;
}

interface UpdateResult {
	current: string;
	latest: string | null;
	updateAvailable: boolean;
}

const CHANNEL_KEY = "claudekit-update-channel";

// Detect if version is beta/prerelease
const isBetaVersion = (version: string): boolean => /-(alpha|beta|rc|dev|next)/.test(version);

const SystemDashboard: React.FC<SystemDashboardProps> = ({ metadata }) => {
	const { t } = useI18n();
	const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
	const [updateStates, setUpdateStates] = useState<ComponentUpdateState[]>([]);
	const [isCheckingAll, setIsCheckingAll] = useState(false);
	const [isUpdatingAll, setIsUpdatingAll] = useState(false);
	const [showBatchUpdateModal, setShowBatchUpdateModal] = useState(false);
	const [channel, setChannel] = useState<Channel>("stable");

	const hasKits = metadata.kits && typeof metadata.kits === "object";
	const kitEntries = hasKits ? Object.entries(metadata.kits as Record<string, unknown>) : [];
	const legacyName = metadata.name as string | undefined;
	const legacyVersion = metadata.version as string | undefined;
	const legacyInstalledAt = metadata.installedAt as string | undefined;
	const hasAnyKit = kitEntries.length > 0 || legacyName;

	// Initialize update states when system info loads
	useEffect(() => {
		if (!systemInfo) return;

		const states: ComponentUpdateState[] = [];

		// Add CLI
		states.push({
			id: "cli",
			type: "cli",
			status: "idle",
			currentVersion: systemInfo.cliVersion,
			latestVersion: null,
		});

		// Add kits
		if (hasKits && kitEntries.length > 0) {
			for (const [kitName, kitData] of kitEntries) {
				const kit = kitData as KitData;
				states.push({
					id: kitName,
					type: "kit",
					status: "idle",
					currentVersion: kit.version ?? "?",
					latestVersion: null,
				});
			}
		} else if (legacyName) {
			states.push({
				id: legacyName,
				type: "kit",
				status: "idle",
				currentVersion: legacyVersion ?? "?",
				latestVersion: null,
			});
		}

		setUpdateStates(states);
	}, [systemInfo, hasKits, kitEntries, legacyName, legacyVersion]);

	// Fetch system info
	useEffect(() => {
		fetch("/api/system/info")
			.then((res) => res.json())
			.then(setSystemInfo)
			.catch(() => setSystemInfo(null));
	}, []);

	// Initialize channel from localStorage or detect from installed version
	useEffect(() => {
		const savedChannel = localStorage.getItem(CHANNEL_KEY) as Channel | null;
		if (savedChannel === "stable" || savedChannel === "beta") {
			setChannel(savedChannel);
		} else if (systemInfo?.cliVersion) {
			// Auto-detect from installed version
			setChannel(isBetaVersion(systemInfo.cliVersion) ? "beta" : "stable");
		}
	}, [systemInfo?.cliVersion]);

	// Persist channel changes to localStorage
	const handleChannelChange = (newChannel: Channel) => {
		setChannel(newChannel);
		localStorage.setItem(CHANNEL_KEY, newChannel);
	};

	// Handle individual component status change
	const handleStatusChange = (id: string, status: UpdateStatus, latestVersion: string | null) => {
		setUpdateStates((prev) =>
			prev.map((state) => (state.id === id ? { ...state, status, latestVersion } : state)),
		);
	};

	// Handle Check All
	const handleCheckAll = async () => {
		setIsCheckingAll(true);

		// Check all components in parallel
		const checkPromises = updateStates.map(async (component) => {
			try {
				const params =
					component.type === "cli"
						? `target=cli&channel=${channel}`
						: `target=kit&kit=${component.id}&channel=${channel}`;
				const res = await fetch(`/api/system/check-updates?${params}`);
				const data: UpdateResult = await res.json();

				return {
					id: component.id,
					status: (data.updateAvailable ? "update-available" : "up-to-date") as UpdateStatus,
					latestVersion: data.latest,
				};
			} catch {
				return {
					id: component.id,
					status: "idle" as UpdateStatus,
					latestVersion: null,
				};
			}
		});

		const results = await Promise.all(checkPromises);

		// Update all states
		setUpdateStates((prev) =>
			prev.map((state) => {
				const result = results.find((r) => r.id === state.id);
				return result
					? { ...state, status: result.status, latestVersion: result.latestVersion }
					: state;
			}),
		);

		setIsCheckingAll(false);
	};

	// Handle Update All
	const handleUpdateAll = () => {
		setShowBatchUpdateModal(true);
	};

	const handleBatchUpdateComplete = () => {
		window.location.reload();
	};

	return (
		<div className="space-y-4">
			{/* Channel Toggle and Batch Controls */}
			<div className="flex items-center justify-between gap-4">
				<SystemChannelToggle value={channel} onChange={handleChannelChange} />
				{updateStates.length > 0 && (
					<SystemBatchControls
						components={updateStates}
						isChecking={isCheckingAll}
						isUpdating={isUpdatingAll}
						onCheckAll={handleCheckAll}
						onUpdateAll={handleUpdateAll}
					/>
				)}
			</div>

			{/* CLI Card */}
			<SystemCliCard
				version={systemInfo?.cliVersion ?? "..."}
				installedAt={undefined}
				externalStatus={updateStates.find((s) => s.id === "cli")?.status}
				externalLatestVersion={updateStates.find((s) => s.id === "cli")?.latestVersion ?? null}
				onStatusChange={(status, latestVersion) => handleStatusChange("cli", status, latestVersion)}
				disabled={isCheckingAll || isUpdatingAll}
				channel={channel}
			/>

			{/* Kit Cards */}
			{hasAnyKit ? (
				<>
					{hasKits && kitEntries.length > 0 ? (
						kitEntries.map(([kitName, kitData]) => {
							const state = updateStates.find((s) => s.id === kitName);
							return (
								<SystemKitCard
									key={kitName}
									kitName={kitName}
									kit={kitData as KitData}
									externalStatus={state?.status}
									externalLatestVersion={state?.latestVersion ?? null}
									onStatusChange={(status, latestVersion) =>
										handleStatusChange(kitName, status, latestVersion)
									}
									disabled={isCheckingAll || isUpdatingAll}
									channel={channel}
								/>
							);
						})
					) : (
						<SystemKitCard
							kitName={legacyName ?? "ClaudeKit"}
							kit={{ version: legacyVersion, installedAt: legacyInstalledAt }}
							externalStatus={updateStates.find((s) => s.id === legacyName)?.status}
							externalLatestVersion={
								updateStates.find((s) => s.id === legacyName)?.latestVersion ?? null
							}
							onStatusChange={(status, latestVersion) =>
								handleStatusChange(legacyName ?? "ClaudeKit", status, latestVersion)
							}
							disabled={isCheckingAll || isUpdatingAll}
							channel={channel}
						/>
					)}
				</>
			) : (
				<div className="bg-dash-bg border border-dash-border rounded-lg p-6 text-center opacity-60">
					<p className="text-sm text-dash-text-secondary">{t("noKitInstalled")}</p>
				</div>
			)}

			{/* Environment Card */}
			{systemInfo && (
				<SystemEnvironmentCard
					configPath={systemInfo.configPath}
					nodeVersion={systemInfo.nodeVersion}
					bunVersion={systemInfo.bunVersion}
					os={systemInfo.os}
				/>
			)}

			{/* Batch Update Modal */}
			<UpdateProgressModal
				isOpen={showBatchUpdateModal}
				onClose={() => setShowBatchUpdateModal(false)}
				target="cli"
				mode="batch"
				components={updateStates
					.filter((s) => s.status === "update-available")
					.map((s) => ({ id: s.id, name: s.id === "cli" ? "CLI" : `${s.id} Kit` }))}
				onComplete={handleBatchUpdateComplete}
			/>
		</div>
	);
};

export default SystemDashboard;
