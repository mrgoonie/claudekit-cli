/**
 * Read-only JSON viewer for raw settings.json content
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { fetchFullSettings } from "../../services/api";

const SettingsJsonViewer: React.FC = () => {
	const { t } = useI18n();
	const [json, setJson] = useState<string>("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchFullSettings()
			.then((data) => setJson(JSON.stringify(data, null, 2)))
			.catch(() => setJson("{}"))
			.finally(() => setLoading(false));
	}, []);

	return (
		<div className="bg-dash-surface rounded-lg border border-dash-border p-4">
			<h3 className="text-sm font-medium text-dash-text mb-3">{t("settingsRawJson")}</h3>
			{loading ? (
				<p className="text-sm text-dash-text-muted">{t("loading")}</p>
			) : (
				<pre className="text-xs font-mono text-dash-text-secondary bg-dash-bg rounded-md p-4 overflow-auto max-h-96 border border-dash-border">
					{json}
				</pre>
			)}
		</div>
	);
};

export default SettingsJsonViewer;
