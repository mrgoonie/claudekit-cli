import { useCallback, useEffect, useRef, useState } from "react";
import { type ConfigResponse, fetchConfig, saveConfig, validateConfig } from "../api/config";

export interface ValidationError {
	path: string;
	message: string;
}

export function useConfig() {
	const [config, setConfig] = useState<ConfigResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});
	const [validating, setValidating] = useState(false);
	const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
	const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

	const runValidation = useCallback(
		async (changes: Record<string, unknown>) => {
			if (!config) return;

			setValidating(true);
			try {
				// Merge pending changes with current config to validate
				const mergedConfig = { ...config.merged };
				for (const [path, value] of Object.entries(changes)) {
					setNestedValue(mergedConfig, path, value);
				}

				const result = await validateConfig(mergedConfig);
				setValidationErrors(result.errors || []);
			} catch (err) {
				console.error("Validation failed:", err);
			} finally {
				setValidating(false);
			}
		},
		[config],
	);

	const updateField = useCallback(
		(path: string, value: unknown) => {
			setPendingChanges((prev) => {
				const newChanges = { ...prev, [path]: value };

				// Debounce validation by 500ms
				if (validationTimeoutRef.current) {
					clearTimeout(validationTimeoutRef.current);
				}
				validationTimeoutRef.current = setTimeout(() => {
					runValidation(newChanges);
				}, 500);

				return newChanges;
			});
		},
		[runValidation],
	);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (validationTimeoutRef.current) {
				clearTimeout(validationTimeoutRef.current);
			}
		};
	}, []);

	const getValidationError = useCallback(
		(path: string): string | undefined => {
			const error = validationErrors.find((e) => e.path === path);
			return error?.message;
		},
		[validationErrors],
	);

	const isFieldValid = useCallback(
		(path: string): boolean => {
			return !validationErrors.some((e) => e.path === path);
		},
		[validationErrors],
	);

	const save = useCallback(
		async (scope: "global" | "local"): Promise<{ success: boolean; error?: string }> => {
			if (!config) return { success: false, error: "No config loaded" };

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
				setValidationErrors([]);
				await load(); // Reload config
				return { success: true };
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to save config";
				setError(errorMessage);
				return { success: false, error: errorMessage };
			} finally {
				setSaving(false);
			}
		},
		[config, pendingChanges, load],
	);

	const reset = useCallback(() => {
		setPendingChanges({});
		setValidationErrors([]);
	}, []);

	const hasPendingChanges = Object.keys(pendingChanges).length > 0;

	return {
		config,
		loading,
		error,
		saving,
		pendingChanges,
		hasPendingChanges,
		validating,
		validationErrors,
		updateField,
		save,
		reset,
		reload: load,
		getValidationError,
		isFieldValid,
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
