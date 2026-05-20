/**
 * Hook for fetching locally-installed skills metadata from the browse API.
 * Distinct from useSkills (marketplace/install) — this is for the read-only browser.
 */
import { useCallback, useEffect, useState } from "react";

export interface SkillBrowserItem {
	name: string;
	description?: string;
	triggers?: string[];
	source: "local" | "github";
	installed: boolean;
}

export interface SkillBrowserDetail extends SkillBrowserItem {
	content: string;
}

const API_BASE = "/api";

async function apiFetchSkillsList(): Promise<SkillBrowserItem[]> {
	const res = await fetch(`${API_BASE}/skills/browse`);
	if (!res.ok) throw new Error("Failed to fetch skills browser list");
	const data = (await res.json()) as { skills: SkillBrowserItem[] };
	return data.skills;
}

async function apiFetchSkillDetail(name: string): Promise<SkillBrowserDetail> {
	const res = await fetch(`${API_BASE}/skills/browse/${encodeURIComponent(name)}`);
	if (!res.ok) {
		if (res.status === 404) throw new Error(`Skill "${name}" not found`);
		throw new Error("Failed to fetch skill detail");
	}
	return res.json() as Promise<SkillBrowserDetail>;
}

export function useSkillsBrowser() {
	const [skills, setSkills] = useState<SkillBrowserItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiFetchSkillsList();
			setSkills(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load skills");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	return { skills, loading, error, reload: load };
}

export function useSkillDetail(name: string) {
	const [detail, setDetail] = useState<SkillBrowserDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiFetchSkillDetail(name);
			setDetail(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load skill detail");
		} finally {
			setLoading(false);
		}
	}, [name]);

	useEffect(() => {
		void load();
	}, [load]);

	return { detail, loading, error, reload: load };
}
