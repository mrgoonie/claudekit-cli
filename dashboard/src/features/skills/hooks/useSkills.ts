import { useState, useEffect, useCallback } from "react";
import { fetchSkills, type Skill } from "@/api/skills";

export function useSkills() {
	const [skills, setSkills] = useState<Skill[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const data = await fetchSkills();
			setSkills(data);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load skills");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	return { skills, loading, error, reload: load };
}
