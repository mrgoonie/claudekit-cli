import {
	DEFAULT_STATUSLINE_LAYOUT,
	DEFAULT_STATUSLINE_THEME,
	type SectionConfig,
	type StatuslineBuilderLayout,
	type StatuslineTheme,
} from "@/types/statusline-types";
/**
 * StatuslineBuilderPage — visual drag-and-drop builder for Claude Code status-line.
 * URL: /statusline
 * Loads/saves statuslineLayout within .ck.json via existing /api/ck-config endpoint.
 * Uses lines-based layout model: lines: string[][], sectionConfig: Record<string, SectionConfig>
 */
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import ResizeHandle from "../components/ResizeHandle";
import { StatuslineSectionList } from "../components/statusline-builder/statusline-section-list";
import { StatuslineTerminalPreview } from "../components/statusline-builder/statusline-terminal-preview";
import { StatuslineThemePicker } from "../components/statusline-builder/statusline-theme-picker";
import { useResizable } from "../hooks/useResizable";
import { useI18n } from "../i18n";
import { fetchCkConfigScope, updateCkConfigField } from "../services/ck-config-api";

// Settings tab removed (YAGNI — baseMode/breakpoint/agentRows/todoTruncation
// don't affect preview yet, renderer needs follow-up PR first)

// Shape of raw API response — may be old sections[] format or new lines[] format
interface RawStatuslineLayout {
	baseMode?: string;
	lines?: string[][];
	sectionConfig?: Record<string, SectionConfig>;
	theme?: Partial<StatuslineTheme>;
	responsiveBreakpoint?: number;
	maxAgentRows?: number;
	todoTruncation?: number;
}

/** Merge raw API response into a fully-typed StatuslineBuilderLayout */
function parseLayout(raw: RawStatuslineLayout): StatuslineBuilderLayout {
	return {
		baseMode:
			(raw.baseMode as StatuslineBuilderLayout["baseMode"]) ?? DEFAULT_STATUSLINE_LAYOUT.baseMode,
		lines: raw.lines ?? DEFAULT_STATUSLINE_LAYOUT.lines,
		sectionConfig: raw.sectionConfig ?? DEFAULT_STATUSLINE_LAYOUT.sectionConfig,
		theme: raw.theme ? { ...DEFAULT_STATUSLINE_THEME, ...raw.theme } : DEFAULT_STATUSLINE_THEME,
		responsiveBreakpoint:
			raw.responsiveBreakpoint ?? DEFAULT_STATUSLINE_LAYOUT.responsiveBreakpoint,
		maxAgentRows: raw.maxAgentRows ?? DEFAULT_STATUSLINE_LAYOUT.maxAgentRows,
		todoTruncation: raw.todoTruncation ?? DEFAULT_STATUSLINE_LAYOUT.todoTruncation,
	};
}

const StatuslineBuilderPage: React.FC = () => {
	const { t } = useI18n();
	const [layout, setLayout] = useState<StatuslineBuilderLayout>(DEFAULT_STATUSLINE_LAYOUT);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [loadError, setLoadError] = useState(false);
	const {
		size: previewPanelWidth,
		isDragging,
		startDrag,
	} = useResizable({
		storageKey: "ck-statusline-preview-width",
		defaultSize: 500,
		minSize: 300,
		maxSize: 900,
		direction: "horizontal",
		invert: true,
	});

	// Load existing config on mount
	useEffect(() => {
		let cancelled = false;
		void fetchCkConfigScope("global")
			.then((res) => {
				if (cancelled) return;
				const raw = res.config.statuslineLayout as RawStatuslineLayout | undefined;
				if (raw) setLayout(parseLayout(raw));
			})
			.catch(() => {
				// Non-fatal: fallback to defaults, surface warning banner
				if (!cancelled) setLoadError(true);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const handleSave = useCallback(async () => {
		setSaving(true);
		setSaveError(null);
		setSaveSuccess(false);
		try {
			// Update only the statuslineLayout field within the selected scope config.
			await updateCkConfigField("statuslineLayout", layout, "global");
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setSaving(false);
		}
	}, [layout]);

	const handleReset = useCallback(() => {
		setLayout(DEFAULT_STATUSLINE_LAYOUT);
		setSaveSuccess(false);
		setSaveError(null);
	}, []);

	const handleLinesChange = useCallback((lines: string[][]) => {
		setLayout((prev) => ({ ...prev, lines }));
	}, []);

	const handleSectionConfigChange = useCallback((sectionConfig: Record<string, SectionConfig>) => {
		setLayout((prev) => ({ ...prev, sectionConfig }));
	}, []);

	const handleThemeChange = useCallback((theme: StatuslineTheme) => {
		setLayout((prev) => ({ ...prev, theme }));
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-dash-text-muted text-sm">{t("loading")}</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Page header */}
			<div className="shrink-0 px-6 py-4 border-b border-dash-border bg-dash-surface">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-lg font-bold text-dash-text">{t("statuslineBuilder")}</h1>
						<p className="text-sm text-dash-text-muted mt-0.5">
							{t("statuslineBuilderDescription")}
						</p>
					</div>
					{saveSuccess && (
						<div className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded px-3 py-1.5">
							{t("statuslineSaved")}
						</div>
					)}
					{loadError && (
						<div className="bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-md text-sm border border-orange-200 dark:border-orange-800">
							{t("statuslineLoadErrorSaveDisabled")}
						</div>
					)}
					{saveError && (
						<div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-1.5">
							{t("statuslineSaveError")}: {saveError}
						</div>
					)}
				</div>
			</div>

			{/* Main content — two-column */}
			<div className="flex-1 overflow-hidden flex">
				{/* Left panel — tabs + controls, takes remaining space */}
				<div className="flex-1 min-w-0 flex flex-col border-r border-dash-border overflow-hidden">
					{/* Theme picker — full panel, no tabs */}
					<div className="flex-1 overflow-y-auto p-4">
						<StatuslineThemePicker
							theme={layout.theme}
							sectionConfig={layout.sectionConfig}
							onChange={handleThemeChange}
							onSectionConfigChange={handleSectionConfigChange}
						/>
					</div>

					{/* Save bar */}
					<div className="shrink-0 px-4 py-3 border-t border-dash-border bg-dash-surface flex gap-2">
						<button
							type="button"
							onClick={handleReset}
							className="text-xs px-3 py-1.5 rounded border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
						>
							{t("statuslineResetDefaults")}
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={saving || loadError}
							className="flex-1 text-xs px-3 py-1.5 rounded border border-dash-accent bg-dash-accent/10 text-dash-accent hover:bg-dash-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
						>
							{saving ? `${t("saving")}…` : t("statuslineSave")}
						</button>
					</div>
				</div>

				{/* Resize handle */}
				<ResizeHandle direction="horizontal" isDragging={isDragging} onMouseDown={startDrag} />

				{/* Right panel — preview + sections editor */}
				<div
					className="shrink-0 overflow-y-auto p-4 bg-dash-bg space-y-4"
					style={{ width: previewPanelWidth }}
				>
					<StatuslineTerminalPreview
						lines={layout.lines}
						sectionConfig={layout.sectionConfig}
						theme={layout.theme}
					/>
					<StatuslineSectionList
						lines={layout.lines}
						sectionConfig={layout.sectionConfig}
						onLinesChange={handleLinesChange}
						onSectionConfigChange={handleSectionConfigChange}
					/>
				</div>
			</div>
		</div>
	);
};

export default StatuslineBuilderPage;
