/**
 * MCP Servers status page — multi-source discovery with table view
 * Shows all configured MCP servers from settings.json, .mcp.json, and project configs
 */
import type React from "react";
import { useMcpServers } from "../hooks/use-mcp-servers";
import { useI18n } from "../i18n";

/** Truncate a string to maxLen chars, appending ellipsis if needed */
function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return `${str.slice(0, maxLen)}…`;
}

/** Derive a short display label for a source string */
function getSourceBadgeLabel(source: string, sourceLabel: string): string {
	return sourceLabel;
}

/** Pick a stable muted color class based on source type */
function getSourceBadgeClass(source: string): string {
	if (source === "settings.json") {
		return "bg-blue-500/10 text-blue-400 border-blue-500/20";
	}
	if (source === ".mcp.json") {
		return "bg-purple-500/10 text-purple-400 border-purple-500/20";
	}
	// project:* sources
	return "bg-amber-500/10 text-amber-400 border-amber-500/20";
}

const McpPage: React.FC = () => {
	const { t } = useI18n();
	const { servers, loading, error, reload } = useMcpServers();

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<div className="w-8 h-8 border-4 border-dash-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
					<p className="text-dash-text-muted">{t("loading")}</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center max-w-md">
					<p className="text-red-500 mb-3">{error}</p>
					<button
						type="button"
						onClick={() => reload()}
						className="px-4 py-2 bg-dash-accent text-white rounded-md hover:bg-dash-accent/90"
					>
						{t("tryAgain")}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col">
			{/* Page header */}
			<div className="border-b border-dash-border bg-dash-surface px-8 py-5">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-dash-text">{t("mcpTitle")}</h1>
						<p className="text-sm text-dash-text-muted mt-0.5">
							{servers.length === 0
								? t("mcpNoServers")
								: `${servers.length} ${servers.length === 1 ? "server" : "servers"} configured`}
						</p>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-auto px-8 py-6">
				{servers.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<svg
							className="w-12 h-12 text-dash-text-muted mb-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={1.5}
						>
							<path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
						</svg>
						<p className="text-dash-text-muted text-sm">{t("mcpNoServers")}</p>
					</div>
				) : (
					<div className="w-full overflow-x-auto">
						<table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
							<thead>
								<tr className="border-b border-dash-border">
									<th
										className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-wider text-dash-text-muted"
										style={{ paddingLeft: 0 }}
									>
										{t("mcpStatus")}
									</th>
									<th className="text-left py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-dash-text-muted">
										{t("mcpServerName")}
									</th>
									<th className="text-left py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-dash-text-muted">
										{t("mcpCommand")}
									</th>
									<th className="text-left py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-dash-text-muted">
										{t("mcpArgs")}
									</th>
									<th className="text-left py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider text-dash-text-muted">
										{t("mcpSource")}
									</th>
								</tr>
							</thead>
							<tbody>
								{servers.map((server) => (
									<tr
										key={`${server.source}-${server.name}`}
										className="border-b border-dash-border/50 hover:bg-dash-surface-hover transition-colors"
									>
										{/* Status dot */}
										<td className="py-3 pr-4" style={{ paddingLeft: 0 }}>
											<div className="flex items-center gap-1.5">
												<div
													className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
													title={t("mcpConfigured")}
												/>
												<span className="text-[11px] text-dash-text-muted">
													{t("mcpConfigured")}
												</span>
											</div>
										</td>

										{/* Server name */}
										<td className="py-3 px-4">
											<span className="font-semibold text-dash-text">{server.name}</span>
										</td>

										{/* Command */}
										<td className="py-3 px-4 max-w-[200px]">
											<span
												className="font-mono text-xs text-dash-text-secondary"
												style={{
													display: "block",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
												title={server.command}
											>
												{truncate(server.command, 40)}
											</span>
										</td>

										{/* Args */}
										<td className="py-3 px-4 max-w-[240px]">
											{server.args.length > 0 ? (
												<span
													className="font-mono text-xs text-dash-text-muted"
													style={{
														display: "block",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
													title={server.args.join(", ")}
												>
													{truncate(server.args.join(", "), 50)}
												</span>
											) : (
												<span className="text-xs text-dash-text-muted opacity-40">—</span>
											)}
										</td>

										{/* Source badge */}
										<td className="py-3 pl-4">
											<span
												className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getSourceBadgeClass(server.source)}`}
												title={server.sourceLabel}
											>
												{truncate(getSourceBadgeLabel(server.source, server.sourceLabel), 28)}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
};

export default McpPage;
