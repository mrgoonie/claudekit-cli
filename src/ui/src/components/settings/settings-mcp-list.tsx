/**
 * MCP servers detail list from settings
 */
import type React from "react";
import { useI18n } from "../../i18n";

interface McpServer {
	name: string;
	command: string;
}

interface SettingsMcpListProps {
	servers: McpServer[];
}

const SettingsMcpList: React.FC<SettingsMcpListProps> = ({ servers }) => {
	const { t } = useI18n();

	if (servers.length === 0) {
		return (
			<div className="bg-dash-surface rounded-lg border border-dash-border p-4">
				<h3 className="text-sm font-medium text-dash-text mb-2">{t("settingsMcpTitle")}</h3>
				<p className="text-sm text-dash-text-muted">{t("settingsNoMcp")}</p>
			</div>
		);
	}

	return (
		<div className="bg-dash-surface rounded-lg border border-dash-border p-4">
			<h3 className="text-sm font-medium text-dash-text mb-3">
				{t("settingsMcpTitle")} ({servers.length})
			</h3>
			<div className="space-y-2">
				{servers.map((server) => (
					<div
						key={server.name}
						className="flex items-start gap-3 p-2.5 rounded-md border border-dash-border hover:bg-dash-surface-hover transition-colors"
					>
						<div className="w-2 h-2 rounded-full bg-dash-accent mt-1.5 shrink-0" />
						<div className="min-w-0 flex-1">
							<p className="text-sm font-medium text-dash-text">{server.name}</p>
							<p className="text-xs font-mono text-dash-text-muted truncate">{server.command}</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default SettingsMcpList;
