import {
	ALL_SECTION_IDS,
	ANSI_COLOR_HEX_MAP,
	DEFAULT_SECTION_COLORS,
	DEFAULT_SECTION_CONFIG,
	type SectionConfig,
	type StatuslineTheme,
	THEME_PRESETS,
} from "@/types/statusline-types";
/**
 * Theme picker for statusline color customization.
 * Applies both global theme colors AND per-section colors when a preset is selected.
 */
import type React from "react";
import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n/translations";

/** Maps section id → i18n label key for color controls */
const SECTION_LABEL_KEYS: Record<string, TranslationKey> = {
	model: "statuslineSectionModelLabel",
	context: "statuslineSectionContextLabel",
	quota: "statuslineSectionQuotaLabel",
	directory: "statuslineSectionDirectoryLabel",
	git: "statuslineSectionGitLabel",
	cost: "statuslineSectionCostLabel",
	changes: "statuslineSectionChangesLabel",
	agents: "statuslineSectionAgentsLabel",
	todos: "statuslineSectionTodosLabel",
};

interface StatuslineThemePickerProps {
	theme: StatuslineTheme;
	sectionConfig: Record<string, SectionConfig>;
	onChange: (theme: StatuslineTheme) => void;
	onSectionConfigChange: (config: Record<string, SectionConfig>) => void;
}

/** ANSI color options available for each field (standard + bright variants) */
const COLOR_OPTIONS = [
	"green",
	"yellow",
	"red",
	"cyan",
	"blue",
	"magenta",
	"white",
	"dim",
	"brightGreen",
	"brightYellow",
	"brightRed",
	"brightCyan",
	"brightBlue",
	"brightMagenta",
	"brightWhite",
];

/** Alias for shared color map — used for swatch preview dots */
const SWATCH_MAP = ANSI_COLOR_HEX_MAP;

interface ColorSelectProps {
	field: string;
	label: string;
	value: string;
	onChange: (v: string) => void;
}

const ColorSelect: React.FC<ColorSelectProps> = ({ field, label, value, onChange }) => (
	<div className="flex items-center gap-2">
		<span
			className="w-3 h-3 rounded-full shrink-0 border border-white/20"
			style={{ backgroundColor: SWATCH_MAP[value] ?? SWATCH_MAP.default }}
		/>
		<label htmlFor={`color-${field}`} className="text-xs text-dash-text-muted w-24 shrink-0">
			{label}
		</label>
		<select
			id={`color-${field}`}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="flex-1 text-xs px-2 py-1 rounded border border-dash-border bg-dash-bg text-dash-text focus:outline-none focus:border-dash-accent"
		>
			{COLOR_OPTIONS.map((c) => (
				<option key={c} value={c}>
					{c}
				</option>
			))}
		</select>
	</div>
);

export const StatuslineThemePicker: React.FC<StatuslineThemePickerProps> = ({
	theme,
	sectionConfig,
	onChange,
	onSectionConfigChange,
}) => {
	const { t } = useI18n();

	const handleField = (field: keyof StatuslineTheme, value: string) => {
		onChange({ ...theme, [field]: value });
	};

	const handleSectionColor = (sectionId: string, color: string) => {
		onSectionConfigChange({
			...sectionConfig,
			[sectionId]: { ...sectionConfig[sectionId], color },
		});
	};

	const handlePresetApply = (preset: (typeof THEME_PRESETS)[number]) => {
		onChange({ ...preset.theme });
		// Apply per-section colors from the preset
		const updated = { ...sectionConfig };
		for (const [id, color] of Object.entries(preset.sectionColors)) {
			updated[id] = { ...updated[id], color };
		}
		onSectionConfigChange(updated);
	};

	// Include all theme fields (including quotaLow/quotaHigh) in preset detection
	const activePresetIndex = THEME_PRESETS.findIndex(
		(p) =>
			p.theme.contextLow === theme.contextLow &&
			p.theme.contextMid === theme.contextMid &&
			p.theme.contextHigh === theme.contextHigh &&
			p.theme.accent === theme.accent &&
			p.theme.muted === theme.muted &&
			p.theme.separator === theme.separator &&
			p.theme.quotaLow === theme.quotaLow &&
			p.theme.quotaHigh === theme.quotaHigh,
	);

	return (
		<div className="space-y-4">
			{/* Preset buttons */}
			<div>
				<p className="text-xs font-medium text-dash-text-muted mb-2 uppercase tracking-wider">
					{t("statuslineTheme")}
				</p>
				<div className="grid grid-cols-2 gap-2">
					{THEME_PRESETS.map((preset, i) => (
						<button
							key={preset.name}
							type="button"
							onClick={() => handlePresetApply(preset)}
							className={`text-xs px-3 py-2 rounded border transition-colors text-left ${
								activePresetIndex === i
									? "border-dash-accent bg-dash-accent/10 text-dash-accent"
									: "border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text"
							}`}
						>
							<span className="flex items-center gap-1">
								{/* Color swatches — show 4 representative colors */}
								{[
									preset.sectionColors.model,
									preset.theme.contextMid,
									preset.sectionColors.git,
									preset.sectionColors.changes,
								].map((c, j) => (
									<span
										key={j}
										className="w-2 h-2 rounded-full shrink-0"
										style={{ backgroundColor: SWATCH_MAP[c] ?? SWATCH_MAP.default }}
									/>
								))}
								<span className="ml-0.5">{t(preset.labelKey as Parameters<typeof t>[0])}</span>
							</span>
						</button>
					))}
				</div>
			</div>

			{/* Grouped color fields */}
			<div className="space-y-4">
				{/* Context Window colors */}
				<div className="space-y-1.5">
					<p className="text-xs font-medium text-dash-text-muted uppercase tracking-wider">
						▰ {t("statuslineColorContextGroup")}
					</p>
					<ColorSelect
						field="contextLow"
						label={t("statuslineColorContextLow")}
						value={theme.contextLow}
						onChange={(v) => handleField("contextLow", v)}
					/>
					<ColorSelect
						field="contextMid"
						label={t("statuslineColorContextMid")}
						value={theme.contextMid}
						onChange={(v) => handleField("contextMid", v)}
					/>
					<ColorSelect
						field="contextHigh"
						label={t("statuslineColorContextHigh")}
						value={theme.contextHigh}
						onChange={(v) => handleField("contextHigh", v)}
					/>
				</div>

				{/* Quota colors */}
				<div className="space-y-1.5">
					<p className="text-xs font-medium text-dash-text-muted uppercase tracking-wider">
						⌛ {t("statuslineColorQuotaGroup")}
					</p>
					<ColorSelect
						field="quotaLow"
						label={t("statuslineQuotaLow")}
						value={theme.quotaLow}
						onChange={(v) => handleField("quotaLow", v)}
					/>
					<ColorSelect
						field="quotaHigh"
						label={t("statuslineQuotaHigh")}
						value={theme.quotaHigh}
						onChange={(v) => handleField("quotaHigh", v)}
					/>
				</div>

				{/* General colors */}
				<div className="space-y-1.5">
					<p className="text-xs font-medium text-dash-text-muted uppercase tracking-wider">
						{t("statuslineColorGeneralGroup")}
					</p>
					<ColorSelect
						field="accent"
						label={t("statuslineColorAccent")}
						value={theme.accent}
						onChange={(v) => handleField("accent", v)}
					/>
					<ColorSelect
						field="muted"
						label={t("statuslineColorMuted")}
						value={theme.muted}
						onChange={(v) => handleField("muted", v)}
					/>
					<ColorSelect
						field="separator"
						label={t("statuslineColorSeparator")}
						value={theme.separator}
						onChange={(v) => handleField("separator", v)}
					/>
				</div>

				{/* Per-section colors */}
				<div className="space-y-1.5">
					<p className="text-xs font-medium text-dash-text-muted uppercase tracking-wider">
						{t("statuslineColorSectionGroup")}
					</p>
					{ALL_SECTION_IDS.filter((id) => id !== "context" && id !== "quota").map((id) => {
						const icon = sectionConfig[id]?.icon ?? DEFAULT_SECTION_CONFIG[id]?.icon ?? "";
						const label = t(
							SECTION_LABEL_KEYS[id] ?? ("statuslineSectionModelLabel" as TranslationKey),
						);
						return (
							<ColorSelect
								key={id}
								field={`section-${id}`}
								label={icon ? `${icon} ${label}` : label}
								value={sectionConfig[id]?.color ?? DEFAULT_SECTION_COLORS[id] ?? "default"}
								onChange={(v) => handleSectionColor(id, v)}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
};
