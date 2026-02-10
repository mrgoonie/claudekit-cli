/**
 * MCP servers list with status indicators and command preview
 */
import type React from "react";
import { useI18n } from "../../i18n";

interface McpServer {
	name: string;
	command: string;
}

interface SettingsMcpListProps {
	servers: McpServer[];
	count: number;
}

/** Server/plug icon */
const McpIcon: React.FC = () => (
	<svg
		className="w-4 h-4 text-dash-text-muted"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={1.5}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
		/>
	</svg>
);

const SettingsMcpList: React.FC<SettingsMcpListProps> = ({ servers, count }) => {
	const { t } = useI18n();

	if (servers.length === 0) {
		return (
			<div className="bg-dash-surface rounded-lg border border-dash-border p-5">
				<div className="flex items-center gap-2 mb-3">
					<McpIcon />
					<h3 className="text-sm font-semibold text-dash-text">{t("settingsMcpTitle")}</h3>
				</div>
				<p className="text-xs text-dash-text-muted">{t("settingsNoMcp")}</p>
			</div>
		);
	}

	return (
		<div className="bg-dash-surface rounded-lg border border-dash-border p-5">
			{/* Header with count */}
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<McpIcon />
					<h3 className="text-sm font-semibold text-dash-text">{t("settingsMcpTitle")}</h3>
				</div>
				<span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-dash-accent-subtle text-dash-accent">
					{count} {t("settingsMcpConfigured")}
				</span>
			</div>

			{/* Server items */}
			<div className="space-y-1.5">
				{servers.map((server) => (
					<div
						key={server.name}
						className="flex items-start gap-2.5 px-3 py-2 rounded-md border border-dash-border-subtle hover:bg-dash-surface-hover transition-colors"
					>
						{/* Status dot — always accent (we don't have runtime status) */}
						<span className="w-1.5 h-1.5 rounded-full bg-dash-accent mt-1.5 shrink-0" />
						<div className="min-w-0 flex-1">
							<p className="text-xs font-medium text-dash-text">{server.name}</p>
							<p className="text-[11px] font-mono text-dash-text-muted truncate mt-0.5">
								{server.command}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default SettingsMcpList;
