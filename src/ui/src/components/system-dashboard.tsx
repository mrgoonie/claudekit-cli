/**
 * SystemDashboard - System health dashboard for Config Editor
 * Shows CLI version, kit cards with update checks, and environment info
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import SystemCliCard from "./system-cli-card";
import SystemEnvironmentCard from "./system-environment-card";
import SystemKitCard, { type KitData } from "./system-kit-card";

interface SystemInfo {
	configPath: string;
	nodeVersion: string;
	bunVersion: string | null;
	os: string;
	cliVersion: string;
}

interface SystemDashboardProps {
	metadata: Record<string, unknown>;
}

const SystemDashboard: React.FC<SystemDashboardProps> = ({ metadata }) => {
	const { t } = useI18n();
	const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

	useEffect(() => {
		fetch("/api/system/info")
			.then((res) => res.json())
			.then(setSystemInfo)
			.catch(() => setSystemInfo(null));
	}, []);

	const hasKits = metadata.kits && typeof metadata.kits === "object";
	const kitEntries = hasKits ? Object.entries(metadata.kits as Record<string, unknown>) : [];
	const legacyName = metadata.name as string | undefined;
	const legacyVersion = metadata.version as string | undefined;
	const legacyInstalledAt = metadata.installedAt as string | undefined;
	const hasAnyKit = kitEntries.length > 0 || legacyName;

	return (
		<div className="space-y-4">
			{/* CLI Card */}
			<SystemCliCard version={systemInfo?.cliVersion ?? "..."} installedAt={undefined} />

			{/* Kit Cards */}
			{hasAnyKit ? (
				<>
					{hasKits && kitEntries.length > 0 ? (
						kitEntries.map(([kitName, kitData]) => (
							<SystemKitCard key={kitName} kitName={kitName} kit={kitData as KitData} />
						))
					) : (
						<SystemKitCard
							kitName={legacyName ?? "ClaudeKit"}
							kit={{ version: legacyVersion, installedAt: legacyInstalledAt }}
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
		</div>
	);
};

export default SystemDashboard;
