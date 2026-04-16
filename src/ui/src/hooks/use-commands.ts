/**
 * Hook for commands browser data fetching.
 * All operations are read-only.
 */
import * as tauri from "@/lib/tauri-commands";
import { useCallback, useEffect, useState } from "react";
import { isTauri } from "./use-tauri";

/** A single command or directory node in the tree */
export interface CommandNode {
	name: string;
	/** Relative path from ~/.claude/commands/ */
	path: string;
	description?: string;
	/** Present for directory nodes; absent for command files */
	children?: CommandNode[];
}

/** Full command detail from GET /api/commands/:path */
export interface CommandDetail {
	name: string;
	path: string;
	content: string;
	description?: string;
}

/** Hook: fetch the full commands tree */
export function useCommands() {
	const [tree, setTree] = useState<CommandNode[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			if (isTauri()) {
				setTree(await tauri.scanCommands());
				return;
			}
			const res = await fetch("/api/commands");
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { tree: CommandNode[] };
			setTree(data.tree);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	return { tree, loading, error, reload: load };
}

/** Hook: fetch detail for a single command by its relative path */
export function useCommandDetail(commandPath: string | undefined) {
	const [detail, setDetail] = useState<CommandDetail | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!commandPath) {
			setDetail(null);
			return;
		}
		try {
			setLoading(true);
			setError(null);
			if (isTauri()) {
				const data = await tauri.getCommandDetail(commandPath.replace(/\//g, "--"));
				setDetail(data);
				return;
			}
			// Encode path separators: "ck/plan" → "ck--plan"
			const slug = commandPath.replace(/\//g, "--");
			const res = await fetch(`/api/commands/detail/${encodeURIComponent(slug)}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as CommandDetail;
			setDetail(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, [commandPath]);

	useEffect(() => {
		void load();
	}, [load]);

	return { detail, loading, error, reload: load };
}

/** Flatten a command tree into a list of leaf nodes (commands only, no dirs) */
export function flattenCommandTree(nodes: CommandNode[]): CommandNode[] {
	const result: CommandNode[] = [];
	for (const node of nodes) {
		if (node.children) {
			result.push(...flattenCommandTree(node.children));
		} else {
			result.push(node);
		}
	}
	return result;
}

/** Count total command files (leaves) in a tree */
export function countCommands(nodes: CommandNode[]): number {
	return flattenCommandTree(nodes).length;
}
