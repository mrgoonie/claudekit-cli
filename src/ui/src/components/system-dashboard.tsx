/**
 * MetadataDisplay - Main metadata tab component for Config Editor
 * Routes to KitCard per installed kit, handles empty state and legacy format
 */
import React from "react";
import { useI18n } from "../i18n";
import KitCard, { type KitData } from "./metadata-display-kit-card";

const MetadataDisplay: React.FC<{ metadata: Record<string, unknown> }> = ({ metadata }) => {
	const { t } = useI18n();

	const hasKits = metadata.kits && typeof metadata.kits === "object";
	const kitEntries = hasKits ? Object.entries(metadata.kits as Record<string, unknown>) : [];
	const legacyName = metadata.name as string | undefined;
	const legacyVersion = metadata.version as string | undefined;
	const legacyInstalledAt = metadata.installedAt as string | undefined;
	const hasAnyKit = kitEntries.length > 0 || legacyName;

	// Empty state
	if (!hasAnyKit) {
		return (
			<div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-4">
				<div className="w-16 h-16 rounded-full bg-dash-bg border border-dash-border flex items-center justify-center text-3xl">
					{"[ ]"}
				</div>
				<div className="max-w-[300px]">
					<p className="text-lg font-bold text-dash-text mb-2">{t("noKitInstalled")}</p>
					<p className="text-sm text-dash-text-secondary">
						Install a ClaudeKit to see metadata information here
					</p>
				</div>
			</div>
		);
	}

	// Multi-kit format
	if (hasKits && kitEntries.length > 0) {
		return (
			<div className="space-y-6">
				{kitEntries.map(([kitName, kitData]) => (
					<KitCard key={kitName} kitName={kitName} kit={kitData as KitData} />
				))}
			</div>
		);
	}

	// Legacy single-kit format
	return (
		<div className="space-y-6">
			<KitCard
				kitName={legacyName ?? "ClaudeKit"}
				kit={{ version: legacyVersion, installedAt: legacyInstalledAt }}
			/>
		</div>
	);
};

export default MetadataDisplay;
