/**
 * SystemSettingsCard - Settings overview card showing active model, hooks, MCP servers
 */
import type React from "react";
import { useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { useI18n } from "../i18n";

const SystemSettingsCard: React.FC = () => {
	const { t } = useI18n();
	const { settings, loading } = useSettings();
	const [showHooks, setShowHooks] = useState(false);
	const [showMcpServers, setShowMcpServers] = useState(false);

	if (loading) {
		return (
			<div className="bg-dash-bg border border-dash-border rounded-lg p-5">
				<div className="animate-pulse">
					<div className="h-5 bg-dash-border rounded w-32 mb-3" />
					<div className="space-y-2">
						<div className="h-4 bg-dash-border rounded w-full" />
						<div className="h-4 bg-dash-border rounded w-3/4" />
					</div>
				</div>
			</div>
		);
	}

	if (!settings) {
		return null;
	}

	return (
		<div className="bg-dash-bg border border-dash-border rounded-lg p-5">
			<h3 className="text-base font-bold text-dash-text mb-3">{t("settingsCardTitle")}</h3>
			<div className="space-y-3 text-sm">
				{/* Active Model */}
				<InfoRow label={t("activeModel")}>
					<span className="text-dash-text-secondary mono">{settings.model}</span>
				</InfoRow>

				{/* Hooks Registered */}
				<InfoRow label={t("hooksRegistered")}>
					<button
						type="button"
						onClick={() => setShowHooks(!showHooks)}
						className="text-dash-accent hover:text-dash-accent-hover transition-colors"
					>
						{settings.hookCount} {t("active")}
					</button>
				</InfoRow>
				{showHooks && settings.hooks && settings.hooks.length > 0 && (
					<div className="ml-4 pl-3 border-l-2 border-dash-border space-y-1 transition-all">
						{settings.hooks.map((hook, idx) => (
							<div key={idx} className="text-xs text-dash-text-muted flex items-center gap-2">
								<span className="mono">{hook.event}</span>
								{!hook.enabled && (
									<span className="px-1.5 py-0.5 bg-dash-border text-dash-text-muted rounded text-[10px]">
										disabled
									</span>
								)}
							</div>
						))}
					</div>
				)}

				{/* MCP Servers */}
				<InfoRow label={t("mcpServersConfigured")}>
					<button
						type="button"
						onClick={() => setShowMcpServers(!showMcpServers)}
						className="text-dash-accent hover:text-dash-accent-hover transition-colors"
					>
						{settings.mcpServerCount} {t("connected")}
					</button>
				</InfoRow>
				{showMcpServers && settings.mcpServers && settings.mcpServers.length > 0 && (
					<div className="ml-4 pl-3 border-l-2 border-dash-border space-y-1 transition-all">
						{settings.mcpServers.map((server, idx) => (
							<div key={idx} className="text-xs text-dash-text-muted mono">
								{server.name}
							</div>
						))}
					</div>
				)}

				{/* Permissions Mode */}
				<InfoRow label={t("permissionsMode")}>
					<span className="text-dash-text-secondary mono">
						{typeof settings.permissions === "string"
							? settings.permissions
							: JSON.stringify(settings.permissions)}
					</span>
				</InfoRow>
			</div>
		</div>
	);
};

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
	<div className="flex items-center justify-between">
		<span className="text-dash-text-muted text-xs">{label}:</span>
		<div>{children}</div>
	</div>
);

export default SystemSettingsCard;
