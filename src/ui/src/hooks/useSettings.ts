import { type ApiSettings, fetchSettings } from "@/services/api";
import { useCallback, useEffect, useState } from "react";

export function useSettings() {
	const [settings, setSettings] = useState<ApiSettings | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadSettings = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await fetchSettings();
			setSettings(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load settings");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	return { settings, loading, error, reload: loadSettings };
}
