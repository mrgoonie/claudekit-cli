/**
 * Model selector dropdown with save button
 * Allows changing the active Claude model via PATCH /api/settings
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";
import { patchSettings } from "../../services/api";

const AVAILABLE_MODELS = [
	{ id: "claude-opus-4-6", label: "Claude Opus 4.6" },
	{ id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
	{ id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

interface SettingsModelSelectorProps {
	currentModel: string;
	onModelSaved: (model: string) => void;
}

const SettingsModelSelector: React.FC<SettingsModelSelectorProps> = ({
	currentModel,
	onModelSaved,
}) => {
	const { t } = useI18n();
	const [selected, setSelected] = useState(currentModel);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const handleSave = async () => {
		if (selected === currentModel) return;
		setSaving(true);
		setSaved(false);
		try {
			await patchSettings({ model: selected });
			onModelSaved(selected);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} catch {
			// Error handling — user sees no change
		} finally {
			setSaving(false);
		}
	};

	const hasChanged = selected !== currentModel;

	return (
		<div className="bg-dash-surface rounded-lg border border-dash-border p-4">
			<label htmlFor="model-select" className="block text-sm font-medium text-dash-text mb-2">
				{t("settingsModelLabel")}
			</label>
			<div className="flex items-center gap-3">
				<select
					id="model-select"
					value={selected}
					onChange={(e) => setSelected(e.target.value)}
					className="flex-1 bg-dash-bg border border-dash-border rounded-md px-3 py-2 text-sm text-dash-text focus:outline-none focus:ring-1 focus:ring-dash-accent"
				>
					{AVAILABLE_MODELS.map((m) => (
						<option key={m.id} value={m.id}>
							{m.label}
						</option>
					))}
				</select>
				<button
					type="button"
					onClick={handleSave}
					disabled={!hasChanged || saving}
					className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
						saved
							? "bg-green-600 text-white"
							: hasChanged
								? "bg-dash-accent text-white hover:opacity-90"
								: "bg-dash-surface-hover text-dash-text-muted cursor-not-allowed"
					}`}
				>
					{saving ? t("saving") : saved ? t("settingsModelSaved") : t("settingsSaveModel")}
				</button>
			</div>
		</div>
	);
};

export default SettingsModelSelector;
