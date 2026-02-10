/**
 * Settings page — two-panel layout: controls (left) + raw JSON viewer (right)
 * JSON panel is resizable via drag handle, no page-level scrolling
 */
import type React from "react";
import { useEffect, useState } from "react";
import ResizeHandle from "../components/ResizeHandle";
import SettingsHooksList from "../components/settings/settings-hooks-list";
import SettingsJsonViewer from "../components/settings/settings-json-viewer";
import SettingsMcpList from "../components/settings/settings-mcp-list";
import SettingsModelSelector from "../components/settings/settings-model-selector";
import { useResizable } from "../hooks/useResizable";
import { useI18n } from "../i18n";
import { type ApiSettings, fetchSettings } from "../services/api";

/** Skeleton placeholder block for loading state */
const SkeletonBlock: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
	<div className="bg-dash-surface rounded-lg border border-dash-border p-5 animate-pulse">
		<div className="h-4 w-32 bg-dash-surface-hover rounded mb-4" />
		{Array.from({ length: lines }).map((_, i) => (
			<div
				key={`skel-${i}`}
				className="h-3 bg-dash-surface-hover rounded mb-2"
				style={{ width: `${80 - i * 15}%` }}
			/>
		))}
	</div>
);

const SettingsPage: React.FC = () => {
	const { t } = useI18n();
	const [settings, setSettings] = useState<ApiSettings | null>(null);
	const [loading, setLoading] = useState(true);

	// Resizable JSON panel width (right side)
	const {
		size: jsonPanelWidth,
		isDragging: isJsonDragging,
		startDrag: startJsonDrag,
	} = useResizable({
		storageKey: "claudekit-settings-json-width",
		defaultSize: 420,
		minSize: 280,
		maxSize: 700,
		invert: true,
	});

	useEffect(() => {
		fetchSettings()
			.then(setSettings)
			.catch(() => setSettings(null))
			.finally(() => setLoading(false));
	}, []);

	const handleModelSaved = (model: string) => {
		if (settings) {
			setSettings({ ...settings, model });
		}
	};

	if (loading) {
		return (
			<div className="h-full flex flex-col overflow-hidden">
				<div className="border-b border-dash-border bg-dash-surface px-8 py-5">
					<div className="h-6 w-28 bg-dash-surface-hover rounded animate-pulse" />
					<div className="h-3 w-64 bg-dash-surface-hover rounded mt-2 animate-pulse" />
				</div>
				<div className="flex-1 flex min-h-0">
					<div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
						<SkeletonBlock lines={4} />
						<SkeletonBlock lines={3} />
						<SkeletonBlock lines={2} />
					</div>
					<div className="w-[420px] shrink-0 border-l border-dash-border p-5 animate-pulse">
						<div className="h-4 w-24 bg-dash-surface-hover rounded mb-4" />
						<div className="h-3 w-3/4 bg-dash-surface-hover rounded mb-2" />
						<div className="h-3 w-1/2 bg-dash-surface-hover rounded mb-2" />
						<div className="h-3 w-2/3 bg-dash-surface-hover rounded" />
					</div>
				</div>
			</div>
		);
	}

	const hookCount = settings?.hooks?.length ?? 0;
	const mcpCount = settings?.mcpServers?.length ?? 0;

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="border-b border-dash-border bg-dash-surface px-8 py-5 shrink-0">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-dash-text">{t("settingsPageTitle")}</h1>
						<p className="text-sm text-dash-text-muted mt-0.5">{t("settingsPageDesc")}</p>
					</div>
					{settings?.model && (
						<div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-dash-accent-subtle border border-dash-border rounded-md">
							<span className="text-[11px] text-dash-text-muted uppercase tracking-wide">
								{t("settingsActiveModelBadge")}
							</span>
							<span className="text-xs font-semibold font-mono text-dash-accent">
								{settings.model}
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Two-panel body: controls left, JSON right */}
			<div className="flex-1 flex min-h-0">
				{/* Left panel — settings controls, scrollable */}
				<div className="flex-1 overflow-y-auto px-8 py-6 min-w-0">
					<div className="space-y-6">
						<SettingsModelSelector
							currentModel={settings?.model ?? "claude-sonnet-4"}
							onModelSaved={handleModelSaved}
						/>
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
							<SettingsHooksList hooks={settings?.hooks ?? []} count={hookCount} />
							<SettingsMcpList servers={settings?.mcpServers ?? []} count={mcpCount} />
						</div>
					</div>
				</div>

				{/* Resize handle between panels */}
				<ResizeHandle
					direction="horizontal"
					isDragging={isJsonDragging}
					onMouseDown={startJsonDrag}
				/>

				{/* Right panel — raw JSON viewer, full height */}
				<div className="shrink-0 overflow-hidden" style={{ width: jsonPanelWidth }}>
					<SettingsJsonViewer fullHeight />
				</div>
			</div>
		</div>
	);
};

export default SettingsPage;
