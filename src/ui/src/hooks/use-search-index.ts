/**
 * Search index hook — builds a flat searchable list from available entities
 * Simple substring matching, no external deps, degrades gracefully if APIs missing
 */
import { useEffect, useMemo, useState } from "react";
import type { Project } from "../types";

export type SearchItemType = "project" | "navigation" | "agent" | "command" | "skill";

export interface SearchItem {
	type: SearchItemType;
	name: string;
	description: string;
	route: string;
}

/** Static navigation items always available */
const NAV_ITEMS: SearchItem[] = [
	{ type: "navigation", name: "Dashboard", description: "Project overview", route: "/" },
	{
		type: "navigation",
		name: "Config Editor",
		description: "Edit Claude configuration",
		route: "/config/global",
	},
	{ type: "navigation", name: "Skills", description: "Browse and manage skills", route: "/skills" },
	{
		type: "navigation",
		name: "Migrate",
		description: "Migrate stack to other providers",
		route: "/migrate",
	},
	{
		type: "navigation",
		name: "Status Line",
		description: "Customize Claude Code statusline",
		route: "/statusline",
	},
	{
		type: "navigation",
		name: "System",
		description: "System updates and environment info",
		route: "/system",
	},
];

/** Case-insensitive substring match — all query terms must appear in name or description */
export function fuzzyMatch(item: SearchItem, query: string): boolean {
	if (!query.trim()) return true;
	const haystack = `${item.name} ${item.description}`.toLowerCase();
	return query
		.toLowerCase()
		.trim()
		.split(/\s+/)
		.every((term) => haystack.includes(term));
}

/** Flatten a command tree into a list of leaf SearchItems */
interface CommandNode {
	name: string;
	path: string;
	description?: string;
	children?: CommandNode[];
}

function flattenCommandTree(nodes: CommandNode[]): SearchItem[] {
	const items: SearchItem[] = [];
	for (const node of nodes) {
		if (node.children) {
			items.push(...flattenCommandTree(node.children));
		} else {
			items.push({
				type: "command",
				name: node.name,
				description: node.description ?? "",
				route: `/commands?selected=${encodeURIComponent(node.path)}`,
			});
		}
	}
	return items;
}

interface UseSearchIndexOptions {
	projects: Project[];
}

interface UseSearchIndexResult {
	search: (query: string) => Record<SearchItemType, SearchItem[]>;
	loading: boolean;
}

export function useSearchIndex({ projects }: UseSearchIndexOptions): UseSearchIndexResult {
	const [dynamicItems, setDynamicItems] = useState<SearchItem[]>([]);
	const [loading, setLoading] = useState(true);

	// Fetch agents, commands, and skills once on mount
	useEffect(() => {
		let cancelled = false;

		async function fetchAll(): Promise<void> {
			const results: SearchItem[] = [];

			// Fetch agents
			try {
				const res = await fetch("/api/agents/browser");
				if (res.ok) {
					const data = (await res.json()) as {
						agents: Array<{ slug: string; name: string; description: string }>;
					};
					for (const agent of data.agents ?? []) {
						results.push({
							type: "agent",
							name: agent.name || agent.slug,
							description: agent.description ?? "",
							route: `/agents?selected=${encodeURIComponent(agent.slug)}`,
						});
					}
				}
			} catch {
				// Non-fatal — degrade gracefully
			}

			// Fetch commands tree
			try {
				const res = await fetch("/api/commands");
				if (res.ok) {
					const data = (await res.json()) as { tree: CommandNode[] };
					results.push(...flattenCommandTree(data.tree ?? []));
				}
			} catch {
				// Non-fatal — degrade gracefully
			}

			// Fetch skills
			try {
				const res = await fetch("/api/skills/browse");
				if (res.ok) {
					const data = (await res.json()) as {
						skills: Array<{ name: string; description?: string }>;
					};
					for (const skill of data.skills ?? []) {
						results.push({
							type: "skill",
							name: skill.name,
							description: skill.description ?? "",
							route: `/skills?selected=${encodeURIComponent(skill.name)}`,
						});
					}
				}
			} catch {
				// Non-fatal — degrade gracefully
			}

			if (!cancelled) {
				setDynamicItems(results);
				setLoading(false);
			}
		}

		fetchAll();
		return () => {
			cancelled = true;
		};
	}, []);

	const projectItems = useMemo<SearchItem[]>(
		() =>
			projects
				.filter((p) => !p.path.endsWith("/.claude") && p.path !== "~/.claude")
				.map((p) => ({
					type: "project" as SearchItemType,
					name: p.name || p.path.split("/").pop() || p.path,
					description: p.path,
					route: `/project/${p.id}`,
				})),
		[projects],
	);

	const allItems = useMemo<SearchItem[]>(
		() => [...NAV_ITEMS, ...projectItems, ...dynamicItems],
		[projectItems, dynamicItems],
	);

	const search = useMemo(
		() =>
			(query: string): Record<SearchItemType, SearchItem[]> => {
				const MAX_PER_GROUP = 5;
				const matched = query.trim()
					? allItems.filter((item) => fuzzyMatch(item, query))
					: allItems;

				const grouped: Record<SearchItemType, SearchItem[]> = {
					project: [],
					navigation: [],
					agent: [],
					command: [],
					skill: [],
				};

				for (const item of matched) {
					const group = grouped[item.type];
					if (group.length < MAX_PER_GROUP) {
						group.push(item);
					}
				}

				return grouped;
			},
		[allItems],
	);

	return { search, loading };
}
