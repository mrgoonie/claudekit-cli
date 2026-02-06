/**
 * Settings page — model selector, hooks list, MCP servers, raw JSON viewer
 */
import type React from "react";
import { useEffect, useState } from "react";
import SettingsHooksList from "../components/settings/settings-hooks-list";
import SettingsJsonViewer from "../components/settings/settings-json-viewer";
import SettingsMcpList from "../components/settings/settings-mcp-list";
import SettingsModelSelector from "../components/settings/settings-model-selector";
import { useI18n } from "../i18n";
import { type ApiSettings, fetchSettings } from "../services/api";

const SettingsPage: React.FC = () => {
	const { t } = useI18n();
	const [settings, setSettings] = useState<ApiSettings | null>(null);
	const [loading, setLoading] = useState(true);

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
			<div className="flex-1 flex items-center justify-center">
				<p className="text-dash-text-muted">{t("loading")}</p>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				<div>
					<h1 className="text-xl font-bold text-dash-text">{t("settingsPageTitle")}</h1>
					<p className="text-sm text-dash-text-muted mt-1">{t("settingsPageDesc")}</p>
				</div>

				<SettingsModelSelector
					currentModel={settings?.model ?? "claude-sonnet-4"}
					onModelSaved={handleModelSaved}
				/>

				<SettingsHooksList hooks={settings?.hooks ?? []} />

				<SettingsMcpList servers={settings?.mcpServers ?? []} />

				<SettingsJsonViewer />
			</div>
		</div>
	);
};

export default SettingsPage;
