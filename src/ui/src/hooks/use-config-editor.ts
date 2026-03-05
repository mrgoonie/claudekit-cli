/**
 * useConfigEditor - Unified hook for config editor state management
 * Handles JSON ↔ form bidirectional sync, save/reset, and field documentation
 */
import { useCallback, useEffect, useState } from "react";
import type { ConfigSource } from "../components/schema-form";
import { CONFIG_FIELD_DOCS, type FieldDoc } from "../services/configFieldDocs";
import { setNestedValue } from "../utils/config-editor-utils";
import { useFieldAtLine } from "./useFieldAtLine";

export interface ConfigData {
	config: Record<string, unknown>;
	sources: Record<string, ConfigSource>;
	global?: Record<string, unknown>;
	local?: Record<string, unknown>;
}

export interface UseConfigEditorOptions {
	scope: "global" | "project";
	projectId?: string;
	fetchConfig: () => Promise<ConfigData>;
	fetchSchema: () => Promise<Record<string, unknown>>;
	saveConfig: (config: Record<string, unknown>) => Promise<void>;
	onReset?: () => Promise<ConfigData> | ConfigData;
}

export interface UseConfigEditorReturn {
	// State
	jsonText: string;
	config: Record<string, unknown>;
	globalConfig: Record<string, unknown>;
	sources: Record<string, ConfigSource>;
	schema: Record<string, unknown> | null;
	isLoading: boolean;
	saveStatus: "idle" | "saving" | "saved" | "error";
	syntaxError: string | null;
	cursorLine: number;
	showResetConfirm: boolean;
	activeFieldPath: string | null;
	fieldDoc: FieldDoc | null;

	// Handlers
	handleJsonChange: (text: string) => void;
	handleFormChange: (path: string, value: unknown) => void;
	handleSave: () => Promise<void>;
	handleReset: () => Promise<void>;
	setCursorLine: (line: number) => void;
	setShowResetConfirm: (show: boolean) => void;
}

export function useConfigEditor(options: UseConfigEditorOptions): UseConfigEditorReturn {
	const { scope, fetchConfig, fetchSchema, saveConfig, onReset } = options;

	// JSON editor state
	const [jsonText, setJsonText] = useState("{}");
	const [cursorLine, setCursorLine] = useState(0);
	const [syntaxError, setSyntaxError] = useState<string | null>(null);

	// Schema form state
	const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
	const [config, setConfig] = useState<Record<string, unknown>>({});
	const [globalConfig, setGlobalConfig] = useState<Record<string, unknown>>({});
	const [sources, setSources] = useState<Record<string, ConfigSource>>({});

	// Shared state
	const [isLoading, setIsLoading] = useState(true);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const [showResetConfirm, setShowResetConfirm] = useState(false);

	// Track which side last edited to avoid infinite sync loops
	const [lastEditSource, setLastEditSource] = useState<"form" | "json" | null>(null);

	// Help panel field detection from JSON cursor
	const activeFieldPath = useFieldAtLine(jsonText, cursorLine);
	const fieldDoc = activeFieldPath ? CONFIG_FIELD_DOCS[activeFieldPath] : null;

	// Load all data on mount
	useEffect(() => {
		const loadData = async () => {
			try {
				const [configData, schemaData] = await Promise.all([fetchConfig(), fetchSchema()]);

				// Handle both global and project config shapes
				const cfg = configData.local ?? configData.config;
				setConfig(cfg);
				setGlobalConfig(configData.global ?? {});
				setSources(configData.sources);
				setSchema(schemaData);
				setJsonText(JSON.stringify(cfg, null, 2));
			} catch (err) {
				console.error("Failed to load config data:", err);
			} finally {
				setIsLoading(false);
			}
		};
		loadData();
	}, [fetchConfig, fetchSchema]);

	// Validate JSON syntax on text changes
	useEffect(() => {
		try {
			JSON.parse(jsonText);
			setSyntaxError(null);
		} catch (e) {
			setSyntaxError(e instanceof Error ? e.message : "Invalid JSON");
		}
	}, [jsonText]);

	// Sync JSON text → form config (when JSON editor is the source)
	useEffect(() => {
		if (lastEditSource !== "json") return;
		try {
			const parsed = JSON.parse(jsonText);
			setConfig(parsed);
		} catch {
			// Invalid JSON — don't update form
		}
	}, [jsonText, lastEditSource]);

	// Handle JSON editor changes
	const handleJsonChange = useCallback((text: string) => {
		setLastEditSource("json");
		setJsonText(text);
	}, []);

	// Handle form field changes — update both config and JSON text
	const handleFormChange = useCallback(
		(path: string, value: unknown) => {
			setLastEditSource("form");
			setConfig((prev) => {
				const updated = setNestedValue(prev, path, value);
				setJsonText(JSON.stringify(updated, null, 2));
				return updated;
			});
			setSources((prev) => ({ ...prev, [path]: scope }));
		},
		[scope],
	);

	// Save config
	const handleSave = useCallback(async () => {
		if (syntaxError) return;
		setSaveStatus("saving");
		try {
			const configToSave = JSON.parse(jsonText);
			await saveConfig(configToSave);
			setConfig(configToSave);
			setSaveStatus("saved");
			setTimeout(() => setSaveStatus("idle"), 2000);
		} catch {
			setSaveStatus("error");
			setTimeout(() => setSaveStatus("idle"), 3000);
		}
	}, [jsonText, syntaxError, saveConfig]);

	// Reset config
	const handleReset = useCallback(async () => {
		setShowResetConfirm(false);
		if (onReset) {
			setIsLoading(true);
			try {
				const configData = await onReset();
				const cfg = configData.local ?? configData.config;
				setConfig(cfg);
				setSources(configData.sources);
				setJsonText(JSON.stringify(cfg, null, 2));
			} catch (err) {
				console.error("Failed to reset:", err);
			} finally {
				setIsLoading(false);
			}
		} else {
			// Default: reset to empty config for project scope
			const emptyConfig = {};
			setConfig(emptyConfig);
			setJsonText(JSON.stringify(emptyConfig, null, 2));
		}
	}, [onReset]);

	return {
		// State
		jsonText,
		config,
		globalConfig,
		sources,
		schema,
		isLoading,
		saveStatus,
		syntaxError,
		cursorLine,
		showResetConfirm,
		activeFieldPath,
		fieldDoc,

		// Handlers
		handleJsonChange,
		handleFormChange,
		handleSave,
		handleReset,
		setCursorLine,
		setShowResetConfirm,
	};
}
