/**
 * Card-based model selector with descriptions and save button
 * Allows changing the active Claude model via PATCH /api/settings
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";
import { patchSettings } from "../../services/api";

const AVAILABLE_MODELS = [
	{
		id: "claude-opus-4-6",
		label: "Claude Opus 4.6",
		tier: "opus" as const,
		descKey: "settingsModelDescOpus" as const,
	},
	{
		id: "claude-sonnet-4-5-20250929",
		label: "Claude Sonnet 4.5",
		tier: "sonnet" as const,
		descKey: "settingsModelDescSonnet" as const,
	},
	{
		id: "claude-haiku-4-5-20251001",
		label: "Claude Haiku 4.5",
		tier: "haiku" as const,
		descKey: "settingsModelDescHaiku" as const,
	},
];

const TIER_COLORS: Record<string, string> = {
	opus: "text-purple-500",
	sonnet: "text-blue-500",
	haiku: "text-emerald-500",
};

/** SVG sparkle icon for model tier */
const ModelIcon: React.FC<{ tier: string }> = ({ tier }) => (
	<svg
		className={`w-5 h-5 ${TIER_COLORS[tier] ?? "text-dash-text-muted"}`}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={1.5}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
		/>
	</svg>
);

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
		<div className="bg-dash-surface rounded-lg border border-dash-border p-5">
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<SectionIcon />
					<h3 className="text-sm font-semibold text-dash-text">{t("settingsModelLabel")}</h3>
				</div>
				<button
					type="button"
					onClick={handleSave}
					disabled={!hasChanged || saving}
					className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
						saved
							? "bg-emerald-600 text-white"
							: hasChanged
								? "bg-dash-accent text-white hover:opacity-90"
								: "bg-dash-surface-hover text-dash-text-muted cursor-not-allowed"
					}`}
				>
					{saving ? t("saving") : saved ? t("settingsModelSaved") : t("settingsSaveModel")}
				</button>
			</div>

			{/* Card-based radio selection */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				{AVAILABLE_MODELS.map((m) => {
					const isSelected = selected === m.id;
					return (
						<button
							key={m.id}
							type="button"
							onClick={() => setSelected(m.id)}
							className={`relative text-left p-3.5 rounded-lg border-2 transition-all ${
								isSelected
									? "border-dash-accent bg-dash-accent-subtle"
									: "border-dash-border-subtle hover:border-dash-border hover:bg-dash-surface-hover"
							}`}
						>
							{/* Radio dot */}
							<div className="flex items-start gap-2.5">
								<div
									className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
										isSelected ? "border-dash-accent" : "border-dash-border"
									}`}
								>
									{isSelected && <div className="w-2 h-2 rounded-full bg-dash-accent" />}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-1.5">
										<ModelIcon tier={m.tier} />
										<span className="text-sm font-medium text-dash-text">{m.label}</span>
									</div>
									<p className="text-xs text-dash-text-muted mt-1 leading-relaxed">
										{t(m.descKey)}
									</p>
								</div>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
};

/** Section header icon — gear/cog */
const SectionIcon: React.FC = () => (
	<svg
		className="w-4 h-4 text-dash-text-muted"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={1.5}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
		/>
		<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
	</svg>
);

export default SettingsModelSelector;
