import { useCallback, useEffect, useState } from "react";
import { type ConfigResponse, fetchConfig, saveConfig } from "../api/config";

export function useConfig() {
	const [config, setConfig] = useState<ConfigResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});

	const load = useCallback(async () => {
		try {
			setLoading(true);
			const data = await fetchConfig();
			setConfig(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load config");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const updateField = useCallback((path: string, value: unknown) => {
		setPendingChanges((prev) => ({
			...prev,
			[path]: value,
		}));
	}, []);

	const save = useCallback(
		async (scope: "global" | "local") => {
			if (!config) return;

			try {
				setSaving(true);

				// Merge pending changes into appropriate config
				const sourceConfig =
					scope === "global" ? config.sources.global || {} : config.sources.local || {};

				const updatedConfig = { ...sourceConfig };
				for (const [path, value] of Object.entries(pendingChanges)) {
					setNestedValue(updatedConfig, path, value);
				}

				await saveConfig(scope, updatedConfig);
				setPendingChanges({});
				await load(); // Reload config
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to save config");
			} finally {
				setSaving(false);
			}
		},
		[config, pendingChanges, load],
	);

	const reset = useCallback(() => {
		setPendingChanges({});
	}, []);

	const hasPendingChanges = Object.keys(pendingChanges).length > 0;

	return {
		config,
		loading,
		error,
		saving,
		pendingChanges,
		hasPendingChanges,
		updateField,
		save,
		reset,
		reload: load,
	};
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown) {
	const keys = path.split(".");
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		if (!(keys[i] in current)) current[keys[i]] = {};
		current = current[keys[i]] as Record<string, unknown>;
	}
	current[keys[keys.length - 1]] = value;
}
