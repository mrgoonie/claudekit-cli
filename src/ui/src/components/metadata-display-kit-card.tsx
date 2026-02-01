/**
 * KitCard - Single kit metadata card with ownership, inventory, hooks, freshness, customization
 */
import React from "react";
import { useI18n } from "../i18n";
import {
	getRelativeTime,
	getCategoryCounts,
	getModifiedCount,
	getOwnershipCounts,
} from "./metadata-display-helpers";

interface TrackedFile {
	path: string;
	checksum: string;
	ownership: "ck" | "user" | "ck-modified";
	installedVersion: string;
	baseChecksum?: string;
	sourceTimestamp?: string;
	installedAt?: string;
}

export interface KitData {
	version?: string;
	installedAt?: string;
	files?: TrackedFile[];
	installedSettings?: {
		hooks?: string[];
		mcpServers?: string[];
	};
	lastUpdateCheck?: string;
	dismissedVersion?: string;
}

// --- Shared sub-components ---

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div>
		<div className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-1">{label}</div>
		<div className="text-sm font-medium text-dash-text">{value}</div>
	</div>
);

const OwnershipBadge: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
	<div className="flex items-center gap-2">
		<span className={`w-2 h-2 rounded-full ${color}`} />
		<span className="text-sm text-dash-text-secondary">{count} {label}</span>
	</div>
);

const Pill: React.FC<{ text: string }> = ({ text }) => (
	<span className="inline-block px-2 py-0.5 text-xs mono bg-dash-bg border border-dash-border rounded text-dash-text-secondary">
		{text}
	</span>
);

const FreshnessRow: React.FC<{ isoString: string; dismissedVersion?: string }> = ({ isoString, dismissedVersion }) => {
	const { t } = useI18n();
	const { label, isStale } = getRelativeTime(isoString);
	return (
		<div className="flex items-center gap-3 text-xs">
			<span className="text-dash-text-muted">{t("lastChecked")}:</span>
			<span className={isStale ? "text-amber-500 font-bold" : "text-dash-text-secondary"}>{label}</span>
			{isStale && (
				<span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded text-[10px] font-bold uppercase">
					{t("staleIndicator")}
				</span>
			)}
			{dismissedVersion && (
				<span className="text-dash-text-muted">{t("skippedVersion")} {dismissedVersion}</span>
			)}
		</div>
	);
};

// --- Kit Card ---

const KitCard: React.FC<{ kitName: string; kit: KitData }> = ({ kitName, kit }) => {
	const { t } = useI18n();
	const files = (kit.files ?? []) as TrackedFile[];
	const ownership = getOwnershipCounts(files);
	const categories = getCategoryCounts(files);
	const modifiedCount = getModifiedCount(files);
	const hooks = kit.installedSettings?.hooks ?? [];
	const mcpServers = kit.installedSettings?.mcpServers ?? [];
	const hasHooksOrMcp = hooks.length > 0 || mcpServers.length > 0;

	return (
		<div className="bg-dash-bg border border-dash-border rounded-lg p-6 space-y-5">
			{/* Header + Version */}
			<div>
				<h3 className="text-lg font-bold text-dash-text capitalize mb-3">{kitName} Kit</h3>
				<div className="grid grid-cols-2 gap-4">
					<InfoRow label={t("kitVersion")} value={kit.version ?? "N/A"} />
					<InfoRow
						label={t("installedOn")}
						value={kit.installedAt ? new Date(kit.installedAt).toLocaleDateString() : "N/A"}
					/>
				</div>
			</div>

			{/* Freshness */}
			{kit.lastUpdateCheck && <FreshnessRow isoString={kit.lastUpdateCheck} dismissedVersion={kit.dismissedVersion} />}

			{/* File ownership breakdown */}
			{files.length > 0 && (
				<div>
					<h4 className="text-xs font-bold text-dash-text-muted uppercase tracking-widest mb-2">{t("fileOwnership")}</h4>
					<div className="flex flex-wrap gap-x-5 gap-y-1">
						<OwnershipBadge label={t("ownershipCk")} count={ownership.ck} color="bg-emerald-500" />
						{ownership.modified > 0 && <OwnershipBadge label={t("ownershipModified")} count={ownership.modified} color="bg-amber-500" />}
						{ownership.user > 0 && <OwnershipBadge label={t("ownershipUser")} count={ownership.user} color="bg-blue-500" />}
					</div>
				</div>
			)}

			{/* Component inventory */}
			{files.length > 0 && (
				<div>
					<h4 className="text-xs font-bold text-dash-text-muted uppercase tracking-widest mb-2">{t("componentInventory")}</h4>
					<div className="grid grid-cols-3 gap-2">
						{Object.entries(categories)
							.filter(([, count]) => count > 0)
							.map(([cat, count]) => (
								<div key={cat} className="flex items-center justify-between px-2 py-1 bg-dash-surface border border-dash-border rounded">
									<span className="text-xs text-dash-text-secondary capitalize">{cat}</span>
									<span className="text-xs font-bold mono text-dash-text">{count}</span>
								</div>
							))}
					</div>
				</div>
			)}

			{/* Customization summary */}
			{modifiedCount > 0 && (
				<div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded">
					<span className="w-2 h-2 rounded-full bg-amber-500" />
					<span className="text-xs text-dash-text-secondary">{modifiedCount} {t("filesModifiedFromDefaults")}</span>
				</div>
			)}

			{/* Hooks & MCP servers */}
			{hasHooksOrMcp && (
				<div className="space-y-3">
					{hooks.length > 0 && (
						<div>
							<h4 className="text-xs font-bold text-dash-text-muted uppercase tracking-widest mb-2">{t("installedHooks")} ({hooks.length})</h4>
							<div className="flex flex-wrap gap-1.5">{hooks.map((h) => <Pill key={h} text={h} />)}</div>
						</div>
					)}
					{mcpServers.length > 0 && (
						<div>
							<h4 className="text-xs font-bold text-dash-text-muted uppercase tracking-widest mb-2">{t("installedMcpServers")} ({mcpServers.length})</h4>
							<div className="flex flex-wrap gap-1.5">{mcpServers.map((s) => <Pill key={s} text={s} />)}</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default KitCard;
