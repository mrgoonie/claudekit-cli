import { ANSI_COLOR_HEX_MAP, type StatuslineTheme, THEME_PRESETS } from "@/types/statusline-types";
/**
 * Theme picker for statusline color customization.
 * Offers 4 preset themes + individual color field overrides including quotaLow/quotaHigh.
 */
import type React from "react";
import { useI18n } from "../../i18n";

interface StatuslineThemePickerProps {
	theme: StatuslineTheme;
	onChange: (theme: StatuslineTheme) => void;
}

/** ANSI color options available for each field */
const COLOR_OPTIONS = [
	"green",
	"yellow",
	"red",
	"cyan",
	"blue",
	"magenta",
	"white",
	"dim",
	"default",
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
	onChange,
}) => {
	const { t } = useI18n();

	const handleField = (field: keyof StatuslineTheme, value: string) => {
		onChange({ ...theme, [field]: value });
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
							onClick={() => onChange({ ...preset.theme })}
							className={`text-xs px-3 py-2 rounded border transition-colors text-left ${
								activePresetIndex === i
									? "border-dash-accent bg-dash-accent/10 text-dash-accent"
									: "border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text"
							}`}
						>
							<span className="flex items-center gap-1.5">
								{/* Color swatches for preset */}
								<span
									className="w-2 h-2 rounded-full"
									style={{ backgroundColor: SWATCH_MAP[preset.theme.contextLow] }}
								/>
								<span
									className="w-2 h-2 rounded-full"
									style={{ backgroundColor: SWATCH_MAP[preset.theme.accent] }}
								/>
								{t(preset.labelKey as Parameters<typeof t>[0])}
							</span>
						</button>
					))}
				</div>
			</div>

			{/* Individual color fields */}
			<div className="space-y-2">
				<p className="text-xs font-medium text-dash-text-muted uppercase tracking-wider">
					{t("statuslineCustomColors")}
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
		</div>
	);
};
