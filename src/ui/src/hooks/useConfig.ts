import { fetchConfig, saveConfig } from "@/services/api";
import type { ConfigData } from "@/types";
import { useCallback, useEffect, useState } from "react";

export function useConfig() {
	const [config, setConfig] = useState<ConfigData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const loadConfig = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await fetchConfig();
			setConfig(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load config");
		} finally {
			setLoading(false);
		}
	}, []);

	const updateConfig = useCallback(
		async (scope: "global" | "local", newConfig: Record<string, unknown>) => {
			try {
				setSaving(true);
				setError(null);
				await saveConfig(scope, newConfig);
				await loadConfig();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to save config");
				throw err;
			} finally {
				setSaving(false);
			}
		},
		[loadConfig],
	);

	useEffect(() => {
		loadConfig();
	}, [loadConfig]);

	return {
		config,
		loading,
		error,
		saving,
		reload: loadConfig,
		update: updateConfig,
	};
}
