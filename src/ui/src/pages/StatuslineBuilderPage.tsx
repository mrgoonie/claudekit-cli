import {
	DEFAULT_STATUSLINE_LAYOUT,
	DEFAULT_STATUSLINE_THEME,
	type StatuslineLayout,
	type StatuslineSection,
	type StatuslineTheme,
} from "@/types/statusline-types";
/**
 * StatuslineBuilderPage — visual drag-and-drop builder for Claude Code status-line.
 * URL: /statusline
 * Loads/saves statuslineLayout within .ck.json via existing /api/ck-config endpoint.
 */
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { StatuslineSectionList } from "../components/statusline-builder/statusline-section-list";
import { StatuslineSettingsPanel } from "../components/statusline-builder/statusline-settings-panel";
import { StatuslineTerminalPreview } from "../components/statusline-builder/statusline-terminal-preview";
import { StatuslineThemePicker } from "../components/statusline-builder/statusline-theme-picker";
import { useI18n } from "../i18n";
import { updateCkConfigField } from "../services/ck-config-api";

type TabId = "sections" | "theme" | "settings";

const TABS: {
	id: TabId;
	labelKey: "statuslineSections" | "statuslineTheme" | "statuslineSettings";
}[] = [
	{ id: "sections", labelKey: "statuslineSections" },
	{ id: "theme", labelKey: "statuslineTheme" },
	{ id: "settings", labelKey: "statuslineSettings" },
];

const StatuslineBuilderPage: React.FC = () => {
	const { t } = useI18n();
	const [activeTab, setActiveTab] = useState<TabId>("sections");
	const [layout, setLayout] = useState<StatuslineLayout>(DEFAULT_STATUSLINE_LAYOUT);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saveSuccess, setSaveSuccess] = useState(false);

	// Load existing config on mount
	useEffect(() => {
		let cancelled = false;
		fetch("/api/ck-config?scope=global")
			.then((res) => {
				if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`);
				return res.json() as Promise<{ config: Record<string, unknown> }>;
			})
			.then((res) => {
				if (cancelled) return;
				const raw = res.config.statuslineLayout as StatuslineLayout | undefined;
				if (raw) {
					setLayout({
						...DEFAULT_STATUSLINE_LAYOUT,
						...raw,
						theme: raw.theme
							? { ...DEFAULT_STATUSLINE_THEME, ...raw.theme }
							: DEFAULT_STATUSLINE_THEME,
						sections: raw.sections ?? DEFAULT_STATUSLINE_LAYOUT.sections,
					});
				}
			})
			.catch(() => {
				// Non-fatal: fallback to defaults
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
			// Use PATCH to update only statuslineLayout — avoids read-modify-write race condition
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

	const handleSectionsChange = (sections: StatuslineSection[]) => {
		setLayout((prev) => ({ ...prev, sections }));
	};

	const handleThemeChange = (theme: StatuslineTheme) => {
		setLayout((prev) => ({ ...prev, theme }));
	};

	const currentSections = layout.sections ?? DEFAULT_STATUSLINE_LAYOUT.sections ?? [];
	const currentTheme = layout.theme ?? DEFAULT_STATUSLINE_THEME;

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
				</div>
			</div>

			{/* Main content — two-column */}
			<div className="flex-1 overflow-hidden flex">
				{/* Left panel (60%) — tabs + controls */}
				<div className="w-[60%] flex flex-col border-r border-dash-border overflow-hidden">
					{/* Tab bar */}
					<div className="shrink-0 flex border-b border-dash-border bg-dash-surface px-4 pt-3">
						{TABS.map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
									activeTab === tab.id
										? "border-dash-accent text-dash-accent"
										: "border-transparent text-dash-text-secondary hover:text-dash-text"
								}`}
							>
								{t(tab.labelKey)}
							</button>
						))}
					</div>

					{/* Tab content */}
					<div className="flex-1 overflow-y-auto p-4">
						{activeTab === "sections" && (
							<StatuslineSectionList sections={currentSections} onChange={handleSectionsChange} />
						)}
						{activeTab === "theme" && (
							<StatuslineThemePicker theme={currentTheme} onChange={handleThemeChange} />
						)}
						{activeTab === "settings" && (
							<StatuslineSettingsPanel
								layout={layout}
								onChange={setLayout}
								onSave={handleSave}
								onReset={handleReset}
								saving={saving}
								saveError={saveError}
								saveSuccess={saveSuccess}
							/>
						)}
					</div>

					{/* Save bar (always visible at bottom of left panel) */}
					{activeTab !== "settings" && (
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
								disabled={saving}
								className="flex-1 text-xs px-3 py-1.5 rounded border border-dash-accent bg-dash-accent/10 text-dash-accent hover:bg-dash-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
							>
								{saving ? `${t("saving")}…` : t("statuslineSave")}
							</button>
						</div>
					)}
				</div>

				{/* Right panel (40%) — live preview */}
				<div className="flex-1 overflow-y-auto p-4 bg-dash-bg">
					<StatuslineTerminalPreview sections={currentSections} theme={currentTheme} />
				</div>
			</div>
		</div>
	);
};

export default StatuslineBuilderPage;
