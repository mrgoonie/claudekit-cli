/**
 * CommandsPage — tree view of all commands in ~/.claude/commands/
 * Route: /commands
 * Read-only. Collapsible namespace sections, real-time search.
 */
import type React from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	type CommandNode,
	countCommands,
	flattenCommandTree,
	useCommands,
} from "../hooks/use-commands";
import { useI18n } from "../i18n";

// ─── Icons ────────────────────────────────────────────────────────────────────

function FolderIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			className="w-4 h-4 shrink-0"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
			/>
		</svg>
	);
}

function ChevronIcon({ open }: { open: boolean }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
		</svg>
	);
}

function CommandIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			className="w-3.5 h-3.5 shrink-0 text-dash-accent"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3" />
		</svg>
	);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Check if a node or any descendant matches the search query */
function nodeMatchesSearch(node: CommandNode, query: string): boolean {
	if (!query) return true;
	const q = query.toLowerCase();
	if (node.name.toLowerCase().includes(q)) return true;
	if (node.description?.toLowerCase().includes(q)) return true;
	if (node.children) {
		return node.children.some((child) => nodeMatchesSearch(child, q));
	}
	return false;
}

/** Filter tree to only include matching nodes (preserving structure) */
function filterTree(nodes: CommandNode[], query: string): CommandNode[] {
	if (!query) return nodes;
	return nodes
		.filter((n) => nodeMatchesSearch(n, query))
		.map((n) => {
			if (!n.children) return n;
			return { ...n, children: filterTree(n.children, query) };
		});
}

// ─── CommandItem ──────────────────────────────────────────────────────────────

function CommandItem({
	node,
	onSelect,
}: {
	node: CommandNode;
	onSelect: (path: string) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(node.path)}
			className="w-full flex items-start gap-2 px-3 py-2 rounded-md hover:bg-dash-surface-hover transition-colors text-left group"
		>
			<CommandIcon />
			<div className="flex-1 min-w-0">
				<span className="text-sm font-semibold text-dash-accent font-mono">/{node.name}</span>
				{node.description && (
					<p className="text-xs text-dash-text-muted mt-0.5 truncate">{node.description}</p>
				)}
			</div>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className="w-3.5 h-3.5 text-dash-text-muted opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
			</svg>
		</button>
	);
}

// ─── DirectorySection ─────────────────────────────────────────────────────────

function DirectorySection({
	node,
	depth,
	forceOpen,
	onSelect,
}: {
	node: CommandNode;
	depth: number;
	forceOpen: boolean;
	onSelect: (path: string) => void;
}) {
	const [open, setOpen] = useState(true);
	const isOpen = forceOpen || open;
	const childCount = countCommands(node.children ?? []);

	return (
		<div className={depth > 0 ? "ml-3 border-l border-dash-border pl-2" : ""}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-dash-surface-hover transition-colors text-left"
			>
				<ChevronIcon open={isOpen} />
				<FolderIcon />
				<span className="text-xs font-bold text-dash-text-muted uppercase tracking-wider flex-1">
					{node.name}
				</span>
				<span className="text-[10px] px-1.5 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold">
					{childCount}
				</span>
			</button>

			{isOpen && (
				<div className="mt-0.5 space-y-0.5">
					{(node.children ?? []).map((child) =>
						child.children ? (
							<DirectorySection
								key={child.path}
								node={child}
								depth={depth + 1}
								forceOpen={forceOpen}
								onSelect={onSelect}
							/>
						) : (
							<CommandItem key={child.path} node={child} onSelect={onSelect} />
						),
					)}
				</div>
			)}
		</div>
	);
}

// ─── RootSection ─────────────────────────────────────────────────────────────

/**
 * Root-level commands (direct children of ~/.claude/commands/ that are files)
 * displayed under a "Root" heading.
 */
function RootCommandsSection({
	nodes,
	forceOpen,
	onSelect,
	label,
}: {
	nodes: CommandNode[];
	forceOpen: boolean;
	onSelect: (path: string) => void;
	label: string;
}) {
	const [open, setOpen] = useState(true);
	const isOpen = forceOpen || open;

	if (nodes.length === 0) return null;

	return (
		<div>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-dash-surface-hover transition-colors text-left"
			>
				<ChevronIcon open={isOpen} />
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="w-4 h-4 shrink-0 text-dash-text-muted"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
					/>
				</svg>
				<span className="text-xs font-bold text-dash-text-muted uppercase tracking-wider flex-1">
					{label}
				</span>
				<span className="text-[10px] px-1.5 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold">
					{nodes.length}
				</span>
			</button>

			{isOpen && (
				<div className="mt-0.5 space-y-0.5">
					{nodes.map((node) => (
						<CommandItem key={node.path} node={node} onSelect={onSelect} />
					))}
				</div>
			)}
		</div>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CommandsPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { tree, loading, error } = useCommands();
	const [search, setSearch] = useState("");

	const filteredTree = useMemo(() => filterTree(tree, search), [tree, search]);

	// Separate root-level files from directories
	const rootFiles = filteredTree.filter((n) => !n.children);
	const directories = filteredTree.filter((n) => n.children);

	const totalCount = useMemo(() => countCommands(tree), [tree]);
	const forceOpen = search.trim().length > 0;

	const handleSelect = (path: string) => {
		navigate(`/commands/${encodeURIComponent(path)}`);
	};

	return (
		<div className="flex flex-col h-full gap-4 max-w-3xl mx-auto w-full">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-bold text-dash-text">{t("commandsBrowser")}</h1>
					{!loading && !error && (
						<p className="text-xs text-dash-text-muted mt-0.5">
							{t("commandsCount").replace("{count}", String(totalCount))}
						</p>
					)}
				</div>
				<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold">
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
					placeholder={t("searchCommandsPlaceholder")}
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

			{/* Loading */}
			{loading && (
				<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm">
					{t("sessionLoading")}
				</div>
			)}

			{/* Error */}
			{!loading && error && (
				<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400 text-sm">
					{t("sessionError")}: {error}
				</div>
			)}

			{/* Empty */}
			{!loading && !error && filteredTree.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm">
					{t("noCommandsFound")}
				</div>
			)}

			{/* Tree */}
			{!loading && !error && filteredTree.length > 0 && (
				<div className="flex flex-col gap-3 overflow-y-auto pb-6">
					{/* Root-level commands */}
					<RootCommandsSection
						nodes={rootFiles}
						forceOpen={forceOpen}
						onSelect={handleSelect}
						label={t("rootCommands")}
					/>

					{/* Namespace directories */}
					{directories.map((dir) => (
						<DirectorySection
							key={dir.path}
							node={dir}
							depth={0}
							forceOpen={forceOpen}
							onSelect={handleSelect}
						/>
					))}
				</div>
			)}
		</div>
	);
};

export default CommandsPage;
