/**
 * Search index hook — builds a flat searchable list from available entities
 * Simple substring matching, no external deps, degrades gracefully if APIs missing
 */
import { useMemo } from "react";
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

interface UseSearchIndexOptions {
	projects: Project[];
}

interface UseSearchIndexResult {
	search: (query: string) => Record<SearchItemType, SearchItem[]>;
	loading: boolean;
}

export function useSearchIndex({ projects }: UseSearchIndexOptions): UseSearchIndexResult {
	// Index is computed synchronously from props — always ready
	const loading = false;

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

	const allItems = useMemo<SearchItem[]>(() => [...NAV_ITEMS, ...projectItems], [projectItems]);

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
