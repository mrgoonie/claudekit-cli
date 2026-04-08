/**
 * Lightweight hook to fetch session counts per project for sidebar display.
 * Maps project path → { sessionCount, lastActive } for O(1) lookup.
 */
import { useEffect, useState } from "react";
import type { SessionProject } from "./use-sessions";

export interface ProjectSessionInfo {
	sessionCount: number;
	lastActive: string;
}

export function useProjectSessionCounts(): Map<string, ProjectSessionInfo> {
	const [counts, setCounts] = useState<Map<string, ProjectSessionInfo>>(new Map());

	useEffect(() => {
		let cancelled = false;
		fetch("/api/sessions")
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json() as Promise<{ projects: SessionProject[] }>;
			})
			.then((data) => {
				if (cancelled) return;
				const map = new Map<string, ProjectSessionInfo>();
				for (const p of data.projects) {
					map.set(p.path, { sessionCount: p.sessionCount, lastActive: p.lastActive });
				}
				setCounts(map);
			})
			.catch(() => {
				// Sidebar is non-critical — silently ignore fetch failures
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return counts;
}
