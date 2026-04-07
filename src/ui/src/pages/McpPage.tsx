/**
 * MCP Servers page — split-panel layout: server table on left, detail on right.
 * Route: /mcp
 */
import type React from "react";
import { useState } from "react";
import ResizeHandle from "../components/ResizeHandle";
import type { McpServer } from "../hooks/use-mcp-servers";
import { useMcpServers } from "../hooks/use-mcp-servers";
import { useResizable } from "../hooks/useResizable";
import { useI18n } from "../i18n";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return `${str.slice(0, maxLen)}…`;
}

function getSourceBadgeClass(source: string): string {
	if (source === "settings.json") {
		return "bg-blue-500/10 text-blue-400 border-blue-500/20";
	}
	if (source === ".mcp.json") {
		return "bg-purple-500/10 text-purple-400 border-purple-500/20";
	}
	return "bg-amber-500/10 text-amber-400 border-amber-500/20";
}

// ─── Server row ───────────────────────────────────────────────────────────────

function ServerRow({
	server,
	selected,
	onClick,
}: {
	server: McpServer;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<tr
			onClick={onClick}
			className={[
				"border-b border-dash-border/50 cursor-pointer transition-colors",
				selected ? "bg-dash-accent/10" : "hover:bg-dash-surface-hover",
			].join(" ")}
		>
			{/* Status dot */}
			<td className="py-3 pr-4" style={{ paddingLeft: 0 }}>
				<div className="flex items-center gap-1.5">
					<div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
				</div>
			</td>

			{/* Server name */}
			<td className="py-3 px-4">
				<span
					className={`font-semibold text-sm ${selected ? "text-dash-accent" : "text-dash-text"}`}
				>
					{server.name}
				</span>
			</td>

			{/* Command */}
			<td className="py-3 px-4 max-w-[180px]">
				<span
					className="font-mono text-xs text-dash-text-secondary block overflow-hidden text-ellipsis whitespace-nowrap"
					title={server.command}
				>
					{truncate(server.command, 32)}
				</span>
			</td>

			{/* Source badge */}
			<td className="py-3 pl-4">
				<span
					className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getSourceBadgeClass(server.source)}`}
					title={server.sourceLabel}
				>
					{truncate(server.sourceLabel, 20)}
				</span>
			</td>
		</tr>
	);
}

// ─── Server detail panel ──────────────────────────────────────────────────────

function ServerDetailPanel({ server }: { server: McpServer }) {
	const { t } = useI18n();

	return (
		<div className="flex flex-col gap-5">
			{/* Name + status */}
			<div className="flex items-start gap-3">
				<div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
				<div>
					<h2 className="text-lg font-bold text-dash-text">{server.name}</h2>
					<span
						className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${getSourceBadgeClass(server.source)}`}
					>
						{server.sourceLabel}
					</span>
				</div>
			</div>

			{/* Details table */}
			<div className="rounded-lg border border-dash-border overflow-hidden text-sm">
				<table className="w-full">
					<tbody>
						{/* Command */}
						<tr className="border-b border-dash-border">
							<td className="px-3 py-2 font-mono text-xs text-dash-text-muted bg-dash-surface w-28 shrink-0 align-top">
								{t("mcpCommand")}
							</td>
							<td className="px-3 py-2 font-mono text-xs text-dash-text break-all">
								{server.command}
							</td>
						</tr>

						{/* Args */}
						{server.args.length > 0 && (
							<tr className="border-b border-dash-border">
								<td className="px-3 py-2 font-mono text-xs text-dash-text-muted bg-dash-surface w-28 align-top">
									{t("mcpArgs")}
								</td>
								<td className="px-3 py-2 text-xs text-dash-text">
									<div className="flex flex-col gap-1">
										{server.args.map((arg, i) => (
											<code
												key={`arg-${i}`}
												className="font-mono bg-dash-surface border border-dash-border rounded px-1.5 py-0.5 text-[11px] break-all"
											>
												{arg}
											</code>
										))}
									</div>
								</td>
							</tr>
						)}

						{/* Env keys */}
						{server.env && Object.keys(server.env).length > 0 && (
							<tr className="border-b border-dash-border last:border-0">
								<td className="px-3 py-2 font-mono text-xs text-dash-text-muted bg-dash-surface w-28 align-top">
									env
								</td>
								<td className="px-3 py-2 text-xs text-dash-text">
									<div className="flex flex-col gap-1">
										{Object.keys(server.env).map((key) => (
											<code
												key={key}
												className="font-mono bg-dash-surface border border-dash-border rounded px-1.5 py-0.5 text-[11px]"
											>
												{key}=<span className="text-dash-text-muted">***</span>
											</code>
										))}
									</div>
								</td>
							</tr>
						)}

						{/* Source */}
						<tr>
							<td className="px-3 py-2 font-mono text-xs text-dash-text-muted bg-dash-surface w-28 align-top">
								{t("mcpSource")}
							</td>
							<td className="px-3 py-2 text-xs text-dash-text font-mono">{server.sourceLabel}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ─── Empty placeholder ─────────────────────────────────────────────────────────

const EmptyDetailPlaceholder: React.FC<{ message: string }> = ({ message }) => (
	<div className="flex items-center justify-center h-full text-sm text-dash-text-muted">
		{message}
	</div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const McpPage: React.FC = () => {
	const { t } = useI18n();
	const { servers, loading, error, reload } = useMcpServers();
	const [selectedKey, setSelectedKey] = useState<string | null>(null);

	const { size, isDragging, startDrag } = useResizable({
		storageKey: "ck-mcp-panel-width",
		defaultSize: 460,
		minSize: 280,
		maxSize: 750,
	});

	const selectedServer = servers.find((s) => `${s.source}-${s.name}` === selectedKey) ?? null;

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
		<div className="flex h-full overflow-hidden">
			{/* Left panel: server list */}
			<div
				style={{ width: `${size}px` }}
				className="shrink-0 flex flex-col overflow-hidden border-r border-dash-border"
			>
				{/* Header */}
				<div className="shrink-0 border-b border-dash-border bg-dash-surface px-4 py-4">
					<h1 className="text-base font-bold text-dash-text">{t("mcpTitle")}</h1>
					<p className="text-xs text-dash-text-muted mt-0.5">
						{servers.length === 0
							? t("mcpNoServers")
							: `${servers.length} ${servers.length === 1 ? "server" : "servers"} configured`}
					</p>
					<p className="text-[11px] text-dash-text-muted font-mono mt-0.5">
						~/.claude/settings.json + .mcp.json
					</p>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-auto px-4 py-4">
					{servers.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<svg
								className="w-10 h-10 text-dash-text-muted mb-3"
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
										<th className="text-left py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider text-dash-text-muted">
											{t("mcpSource")}
										</th>
									</tr>
								</thead>
								<tbody>
									{servers.map((server) => {
										const key = `${server.source}-${server.name}`;
										return (
											<ServerRow
												key={key}
												server={server}
												selected={selectedKey === key}
												onClick={() => setSelectedKey(key)}
											/>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>

			{/* Resize handle */}
			<ResizeHandle onMouseDown={startDrag} isDragging={isDragging} direction="horizontal" />

			{/* Right panel: detail */}
			<div className="flex-1 overflow-y-auto p-6">
				{selectedServer ? (
					<ServerDetailPanel server={selectedServer} />
				) : (
					<EmptyDetailPlaceholder message={t("selectToView")} />
				)}
			</div>
		</div>
	);
};

export default McpPage;
