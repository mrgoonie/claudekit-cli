import { fetchSkills } from "@/services/api";
import type { Skill } from "@/types";
import { useCallback, useEffect, useState } from "react";

export function useSkills() {
	const [skills, setSkills] = useState<Skill[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadSkills = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await fetchSkills();
			setSkills(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load skills");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadSkills();
	}, [loadSkills]);

	return { skills, loading, error, reload: loadSkills };
}
