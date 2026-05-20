/**
 * MCP Servers page — split-panel layout: flat list on left, detail on right.
 * Route: /mcp
 * Design: mirrors CommandsPage exactly (dash-* CSS vars, same item/detail patterns).
 */
import type React from "react";
import { useMemo, useState } from "react";
import ResizeHandle from "../components/ResizeHandle";
import type { McpServer } from "../hooks/use-mcp-servers";
import { useMcpServers } from "../hooks/use-mcp-servers";
import { useResizable } from "../hooks/useResizable";
import { useI18n } from "../i18n";

// ─── Icon ─────────────────────────────────────────────────────────────────────

function McpIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			className="w-3.5 h-3.5 shrink-0 text-dash-accent"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M5 12h14M12 5l7 7-7 7"
			/>
		</svg>
	);
}

// ─── Source group header ───────────────────────────────────────────────────────

function SourceGroupHeader({ label, count }: { label: string; count: number }) {
	return (
		<div className="flex items-center gap-2 px-2 py-1.5">
			<span className="text-xs font-bold text-dash-text-muted uppercase tracking-wider flex-1">
				{label}
			</span>
			<span className="text-[10px] px-1.5 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold">
				{count}
			</span>
		</div>
	);
}

// ─── Server list item ──────────────────────────────────────────────────────────

function ServerItem({
	server,
	selected,
	onClick,
}: {
	server: McpServer;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				"w-full flex items-start gap-2 px-3 py-2 rounded-md transition-colors text-left group",
				selected
					? "bg-dash-accent/10 border border-dash-accent/30"
					: "hover:bg-dash-surface-hover border border-transparent",
			].join(" ")}
		>
			<McpIcon />
			<div className="flex-1 min-w-0">
				<span className="text-sm font-semibold text-dash-accent font-mono">{server.name}</span>
				<p className="text-xs text-dash-text-muted mt-0.5 truncate font-mono">{server.command}</p>
			</div>
		</button>
	);
}

// ─── Server detail panel ──────────────────────────────────────────────────────

function ServerDetailPanel({ server }: { server: McpServer }) {
	const { t } = useI18n();

	return (
		<div className="flex flex-col gap-4">
			{/* Title + read-only badge */}
			<div className="flex items-center gap-3">
				<h2 className="text-base font-semibold text-dash-text font-mono truncate flex-1">
					{server.name}
				</h2>
				<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
					{t("sessionReadOnly")}
				</span>
			</div>

			{/* Source path badge */}
			<div className="flex items-center gap-2 text-xs text-dash-text-muted">
				<span className="font-mono px-2 py-0.5 rounded bg-dash-surface border border-dash-border text-dash-accent">
					{server.sourceLabel}
				</span>
			</div>

			{/* Details table */}
			<div className="rounded-lg border border-dash-border bg-dash-surface p-5 overflow-x-auto">
				<table className="w-full text-sm">
					<tbody>
						{/* Command */}
						<tr className="border-b border-dash-border">
							<td className="py-2 pr-4 font-mono text-xs text-dash-text-muted w-28 shrink-0 align-top">
								{t("mcpCommand")}
							</td>
							<td className="py-2 font-mono text-xs text-dash-text break-all">{server.command}</td>
						</tr>

						{/* Args */}
						{server.args.length > 0 && (
							<tr className="border-b border-dash-border">
								<td className="py-2 pr-4 font-mono text-xs text-dash-text-muted w-28 align-top">
									{t("mcpArgs")}
								</td>
								<td className="py-2 text-xs text-dash-text">
									<div className="flex flex-col gap-1">
										{server.args.map((arg, i) => (
											<code
												key={i}
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
							<tr className="border-b border-dash-border">
								<td className="py-2 pr-4 font-mono text-xs text-dash-text-muted w-28 align-top">
									env
								</td>
								<td className="py-2 text-xs text-dash-text">
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
							<td className="py-2 pr-4 font-mono text-xs text-dash-text-muted w-28 align-top">
								{t("mcpSource")}
							</td>
							<td className="py-2 text-xs text-dash-text font-mono">{server.sourceLabel}</td>
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

// ─── Main page ─────────────────────────────────────────────────────────────────

const McpPage: React.FC = () => {
	const { t } = useI18n();
	const { servers, loading, error } = useMcpServers();
	const [search, setSearch] = useState("");
	const [selectedKey, setSelectedKey] = useState<string | null>(null);

	const { size, isDragging, startDrag } = useResizable({
		storageKey: "ck-mcp-panel-width",
		defaultSize: 380,
		minSize: 260,
		maxSize: 650,
	});

	const serverKey = (s: McpServer) => `${s.source}-${s.name}`;
	const selectedServer = servers.find((s) => serverKey(s) === selectedKey) ?? null;

	const filtered = useMemo(() => {
		if (!search.trim()) return servers;
		const q = search.toLowerCase();
		return servers.filter(
			(s) =>
				s.name.toLowerCase().includes(q) ||
				s.command.toLowerCase().includes(q) ||
				s.sourceLabel.toLowerCase().includes(q),
		);
	}, [servers, search]);

	// Group by source label
	const groups = useMemo(() => {
		const map = new Map<string, McpServer[]>();
		for (const server of filtered) {
			const arr = map.get(server.sourceLabel) ?? [];
			arr.push(server);
			map.set(server.sourceLabel, arr);
		}
		return map;
	}, [filtered]);

	return (
		<div className="flex h-full overflow-hidden">
			{/* Left panel: list */}
			<div
				style={{ width: `${size}px` }}
				className="shrink-0 flex flex-col overflow-hidden border-r border-dash-border"
			>
				{/* Header */}
				<div className="shrink-0 px-4 pt-4 pb-3 border-b border-dash-border">
					<div className="flex items-start justify-between mb-3">
						<div>
							<h1 className="text-base font-bold text-dash-text">{t("mcpTitle")}</h1>
							{!loading && !error && (
								<p className="text-xs text-dash-text-muted mt-0.5">
									{servers.length === 0
										? t("mcpNoServers")
										: `${servers.length} ${servers.length === 1 ? "server" : "servers"} configured`}
								</p>
							)}
							<p className="text-[11px] text-dash-text-muted font-mono mt-0.5">
								~/.claude.json + settings.json + .mcp.json
							</p>
						</div>
						<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
							{t("sessionReadOnly")}
						</span>
					</div>

					{/* Search */}
					<div className="relative">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-text-muted pointer-events-none"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("mcpServerName")}
							className="w-full pl-9 pr-4 py-2 text-sm bg-dash-surface border border-dash-border rounded-lg text-dash-text placeholder:text-dash-text-muted focus:outline-none focus:border-dash-accent/50 transition-colors"
						/>
						{search && (
							<button
								type="button"
								onClick={() => setSearch("")}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-dash-text-muted hover:text-dash-text transition-colors"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						)}
					</div>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-2 py-2">
					{loading && (
						<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm p-8">
							{t("loading")}
						</div>
					)}

					{!loading && error && (
						<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400 text-sm m-2">
							{error}
						</div>
					)}

					{!loading && !error && groups.size === 0 && (
						<div className="flex items-center justify-center p-8 text-dash-text-muted text-sm">
							{t("mcpNoServers")}
						</div>
					)}

					{!loading && !error && groups.size > 0 && (
						<div className="flex flex-col gap-2 pb-4">
							{Array.from(groups.entries()).map(([label, groupServers]) => (
								<div key={label}>
									{groups.size > 1 && (
										<SourceGroupHeader label={label} count={groupServers.length} />
									)}
									<div className="space-y-0.5">
										{groupServers.map((server) => {
											const key = serverKey(server);
											return (
												<ServerItem
													key={key}
													server={server}
													selected={selectedKey === key}
													onClick={() => setSelectedKey(key)}
												/>
											);
										})}
									</div>
								</div>
							))}
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
